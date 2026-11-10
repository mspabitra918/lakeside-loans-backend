import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectModel } from "@nestjs/sequelize";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { MailService } from "../../common/mail/mail.service";
import { LoanApplication } from "../loan-application.model";
import { DRIP_QUEUE, DripJobData } from "./drip.service";
import { CONTACT, DRIP_CANCEL_STEP, DRIP_TEMPLATES } from "./drip.templates";
import { BankAccountVerification } from "src/bank-verification/bank-account-verification.model";
import { DripEmailSchedule } from "./drip-email-schedule.model";

/**
 * Fires one drip step. Before sending anything it re-reads the verification
 * row: if it is no longer "pending" (i.e. already verified, failed, or
 * cancelled) the job returns without sending — this is what makes a completed
 * verification stop the sequence even for steps already sitting in the queue.
 *
 * NOTE: a BullMQ worker only runs inside a long-lived Node process
 * (`npm run start:prod`). On a purely serverless deploy no worker consumes the
 * queue — run this process alongside, or on, a host that stays up.
 */
@Processor(DRIP_QUEUE)
export class DripProcessor extends WorkerHost {
  private readonly logger = new Logger(DripProcessor.name);

  constructor(
    @InjectModel(BankAccountVerification)
    private readonly verifications: typeof BankAccountVerification,
    @InjectModel(LoanApplication)
    private readonly applications: typeof LoanApplication,
    @InjectModel(DripEmailSchedule)
    private readonly schedules: typeof DripEmailSchedule,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<DripJobData>): Promise<void> {
    const { verificationId, step, verifyToken } = job.data;
    const template = DRIP_TEMPLATES[step];
    if (!template) return;

    const verification = await this.verifications.findByPk(verificationId);
    if (!verification) return;

    const application = await this.applications.findOne({
      where: { reference: verification.applicationId },
    });
    if (!application) return;

    const schedule = await this.schedules.findOne({
      where: { applicationId: application.id, emailNumber: step },
    });
    if (!schedule || schedule.status === "sent" || schedule.status === "cancelled") {
      return;
    }

    await schedule.increment("attempts");
    await schedule.update({
      status: "sending",
      lockedAt: new Date(),
      resolution: null,
    });

    // The stop condition: anything other than an open, pending verification
    // means we must not keep nudging.
    if (verification.status !== "pending") {
      await schedule.update({
        status: "skipped",
        lockedAt: null,
        resolution: `Verification status is ${verification.status}.`,
      });
      this.logger.log(
        `Skipping drip step ${step} for ${verificationId}: status=${verification.status}.`,
      );
      return;
    }

    const frontendUrl = this.config.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
    const verifyUrl = new URL(
      `/bank-verification/${encodeURIComponent(verifyToken)}`,
      frontendUrl,
    ).toString();
    const ctaHref =
      template.cta.target === "phone" ? `tel:${CONTACT.local.tel}` : verifyUrl;

    try {
      // The final step cancels the application for now. "withdrawn" is the
      // closest existing loan status to "cancelled".
      if (step === DRIP_CANCEL_STEP) {
        if (application.status === "received") {
          await application.update({
            status: "withdrawn",
            decisionNotes:
              "Auto-cancelled: bank verification not completed within 72 hours.",
            decidedAt: new Date(),
          });
        }
        await verification.update({ status: "expired" });
      }

      const sent = await this.mail.sendDripEmail({
        to: application.email,
        applicantName: application.firstName,
        reference: application.reference,
        subject: template.subject,
        step,
        previewText: template.previewText,
        label: template.label,
        tone: template.tone,
        title: template.title,
        body: template.body,
        ctaLabel: template.cta.label,
        ctaHref,
      });

      await schedule.update({
        status: sent ? "sent" : "skipped",
        sentAt: sent ? new Date() : null,
        statusAtSend: application.status,
        lockedAt: null,
        resolution: sent ? null : "SMTP is not configured.",
      });

      this.logger.log(
        `${sent ? "Sent" : "Skipped"} drip step ${step} (${template.label}) for verification ${verificationId}.`,
      );
    } catch (error) {
      const resolution =
        error instanceof Error ? error.message : "Unknown email delivery error";
      await schedule.update({
        status: "failed",
        lockedAt: null,
        resolution,
      });
      throw error;
    }
  }
}
