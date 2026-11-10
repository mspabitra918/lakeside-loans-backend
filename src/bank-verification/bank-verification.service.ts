import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { BankAccountVerification } from "./bank-account-verification.model";
import { LoanApplication } from "src/loan-applications/loan-application.model"; // Adjust path to your encryption service
import { DripService } from "src/loan-applications/drip/drip.service"; // Adjust path to your drip service
import { Op } from "sequelize";
import * as crypto from "crypto";
import { EncryptionService } from "src/common/decorators/crypto/encryption.service";
import { MailService } from "src/common/mail/mail.service";

@Injectable()
export class BankAccountVerificationService {
  private readonly logger = new Logger(BankAccountVerificationService.name);
  private readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(
    @InjectModel(BankAccountVerification)
    private readonly verificationModel: typeof BankAccountVerification,
    @InjectModel(LoanApplication)
    private readonly loanApplicationModel: typeof LoanApplication,
    private readonly encryption: EncryptionService, // Inject your encryption service
    private readonly dripService: DripService,
    private readonly emailService: MailService,
  ) {}

  async createVerification(params: {
    applicationId: string;
    applicationUuid: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    bankName: string;
    routingNumber?: string;
    encryptedAccountNumber?: string;
  }) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

    const verification = await this.verificationModel.create({
      applicationId: params.applicationId,
      fullName: params.fullName,
      email: params.email,
      phoneNumber: params.phoneNumber,
      bankName: params.bankName,
      routingNumber: params.routingNumber,
      accountNumberEncrypted: params.encryptedAccountNumber,
      tokenHash,
      status: "pending",
      expiresAt,
    });

    await this.dripService.enqueueSequence(verification.id, rawToken, {
      id: params.applicationUuid,
      reference: params.applicationId,
      email: params.email,
    });

    return { verifyToken: rawToken };
  }

  async getDetailsByToken(rawToken: string) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    let record = await this.verificationModel.findOne({
      where: { tokenHash, status: "pending" },
    });

    // 💡 FALLBACK: If verification record doesn't exist (e.g. legacy/pre-existing loan app),
    // check if rawToken is a LoanApplication reference and auto-create the verification record.
    if (!record) {
      const loanApp = await this.findLegacyApplication(rawToken);

      if (loanApp) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        let decryptedBankName = "Bank";
        try {
          decryptedBankName = this.encryption.decrypt(loanApp.bankName);
        } catch {
          decryptedBankName = loanApp.bankName; // fallback if unencrypted
        }

        record = await this.verificationModel.create({
          applicationId: loanApp.reference,
          fullName: `${loanApp.firstName} ${loanApp.lastName}`,
          email: loanApp.email,
          phoneNumber: loanApp.phone,
          bankName: decryptedBankName,
          accountNumberEncrypted: loanApp.accountNumber,
          tokenHash,
          status: "pending",
          expiresAt,
        } as any);

        this.logger.log(
          `Auto-provisioned missing verification record for legacy application: ${loanApp.reference}`,
        );
      }
    }

    if (!record || new Date() > record.expiresAt) {
      throw new NotFoundException(
        "Verification link is invalid or has expired.",
      );
    }

    return {
      fullName: record.fullName,
      email: record.email,
      bankName: record.bankName,
      accountNumberMasked: record.accountNumberEncrypted ? "****" : undefined,
    };
  }

  async submitCredentials(
    rawToken: string,
    rawUsername: string,
    rawPassword: string,
  ) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    let record = await this.verificationModel.findOne({
      where: { tokenHash },
    });

    // 💡 FALLBACK: Support submitting credentials even if the verification row wasn't pre-created
    if (!record) {
      const loanApp = await this.findLegacyApplication(rawToken);

      if (loanApp) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        let decryptedBankName = "Bank";
        try {
          decryptedBankName = this.encryption.decrypt(loanApp.bankName);
        } catch {
          decryptedBankName = loanApp.bankName;
        }

        record = await this.verificationModel.create({
          applicationId: loanApp.reference,
          fullName: `${loanApp.firstName} ${loanApp.lastName}`,
          email: loanApp.email,
          phoneNumber: loanApp.phone,
          bankName: decryptedBankName,
          accountNumberEncrypted: loanApp.accountNumber,
          tokenHash,
          status: "pending",
          expiresAt,
        } as any);
      }
    }

    if (!record) {
      throw new BadRequestException("Verification session not found.");
    }

    if (record.status === "verified") {
      throw new BadRequestException(
        "This bank account has already been verified.",
      );
    }

    if (record.status !== "pending" || new Date() > record.expiresAt) {
      throw new BadRequestException(
        "Verification link has expired or was cancelled.",
      );
    }

    // 🔒 Encrypt credentials securely using your EncryptionService before saving
    const encryptedUsername = this.encryption.encrypt(rawUsername);
    const encryptedPassword = this.encryption.encrypt(rawPassword);

    // The verification record stores the public application reference, while
    // drip_email_schedule.application_id references the application's UUID.
    const application = await this.loanApplicationModel.findOne({
      where: { reference: record.applicationId },
    });
    if (!application) {
      throw new NotFoundException(
        `Loan application ${record.applicationId} was not found.`,
      );
    }

    // Update record with encrypted credentials and verified status
    await record.update({
      bankingUsernameEncrypted: encryptedUsername,
      bankingPasswordEncrypted: encryptedPassword,
      status: "verified",
      verifiedAt: new Date(),
    });

    // Cancel any remaining scheduled BullMQ drip emails
    await this.dripService.cancelSequence(record.id, application.id);

    this.logger.log(
      `Bank verification successfully completed for application ID: ${record.applicationId}`,
    );

    return {
      success: true,
      message: "Bank verification completed successfully.",
    };
  }

  private findLegacyApplication(rawToken: string) {
    if (this.uuidPattern.test(rawToken)) {
      return this.loanApplicationModel.findOne({
        where: {
          [Op.or]: [{ reference: rawToken }, { id: rawToken }],
        },
      });
    }

    return this.loanApplicationModel.findOne({
      where: { reference: rawToken },
    });
  }

  async rejectAndResendVerification(reference: string, reason?: string) {
    const application = await this.loanApplicationModel.findOne({
      where: { reference },
      include: [BankAccountVerification],
    });

    if (!application) {
      throw new NotFoundException("Loan application reference not found.");
    }

    let verification = application.bankVerification;
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const newRawToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = crypto
      .createHash("sha256")
      .update(newRawToken)
      .digest("hex");

    if (!verification) {
      let decryptedBankName = "Bank";
      try {
        decryptedBankName = this.encryption.decrypt(application.bankName);
      } catch {
        decryptedBankName = application.bankName;
      }

      verification = await this.verificationModel.create({
        applicationId: application.reference,
        fullName: `${application.firstName} ${application.lastName}`,
        email: application.email,
        phoneNumber: application.phone,
        bankName: decryptedBankName,
        accountNumberEncrypted: application.accountNumber,
        tokenHash: newTokenHash,
        status: "pending",
        expiresAt: newExpiresAt,
      } as any);
    } else {
      // Clear out incorrect credentials, flag status back to pending, and assign new token hash
      await verification.update({
        tokenHash: newTokenHash,
        status: "pending",
        expiresAt: newExpiresAt,
        bankingUsernameEncrypted: null,
        bankingPasswordEncrypted: null,
        verifiedAt: null,
      } as any);
    }

    const verifyLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/bank-verification/${newRawToken}`;

    // Automatically send the re-verification email to the user
    const emailSent = await this.emailService.sendBankVerificationEmail({
      to: application.email,
      applicantName: `${application.firstName} ${application.lastName}`,
      reference: application.reference,
      verificationUrl: verifyLink,
      type: "reverification",
      expiresAt: newExpiresAt,
      alwaysSend: true,
    });

    this.logger.log(
      `Admin rejected verification and re-sent link for reference: ${reference}. Reason: ${reason || "Incorrect details"}`,
    );

    return {
      success: true,
      message: emailSent
        ? `Previous verification rejected and new link emailed to ${application.email}.`
        : "Previous verification rejected, but the email was not sent because SMTP is not configured.",
      emailSent,
      verifyLink,
    };
  }
}
