import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/sequelize";
import { ConfigService } from "@nestjs/config";
import { Op } from "sequelize";
import { MailService } from "../../common/mail/mail.service";
import { LoanApplication } from "../loan-application.model";
import { BankAccountVerification } from "src/bank-verification/bank-account-verification.model";
import { DripEmailSchedule } from "./drip-email-schedule.model";
import { CONTACT, DRIP_CANCEL_STEP, DRIP_TEMPLATES } from "./drip.templates";

/**
 * DB-driven replacement for the old BullMQ DripProcessor. Every minute it finds
 * due `drip_email_schedule` rows, claims each one atomically (so overlapping
 * runs or multiple instances cannot double-send), and sends the email — exactly
 * the logic the worker used, minus Redis.
 *
 * A row is "due" when status = "scheduled" and scheduledAt <= now. Rows stuck in
 * "sending" (e.g. a crash mid-send) for over STALE_LOCK_MS are reclaimed.
 */
@Injectable()
export class DripCronService {
  private readonly logger = new Logger(DripCronService.name);
  private running = false;

  private static readonly STALE_LOCK_MS = 10 * 60 * 1000;
  private static readonly BATCH = 50;

  constructor(
    @InjectModel(DripEmailSchedule)
    private readonly schedules: typeof DripEmailSchedule,
    @InjectModel(BankAccountVerification)
    private readonly verifications: typeof BankAccountVerification,
    @InjectModel(LoanApplication)
    private readonly applications: typeof LoanApplication,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDue(): Promise<void> {
    // Guard against a slow run overlapping the next tick within this process.
    if (this.running) return;
    this.running = true;
    try {
      await this.reclaimStaleLocks();

      const now = new Date();
      const due = await this.schedules.findAll({
        where: {
          track: "bank-verification",
          status: "scheduled",
          scheduledAt: { [Op.lte]: now },
        },
        order: [["scheduledAt", "ASC"]],
        limit: DripCronService.BATCH,
      });

      for (const row of due) {
        await this.processRow(row).catch((error) => {
          const message =
            error instanceof Error ? error.message : "unknown error";
          this.logger.error(
            `Drip row ${row.id} (app ${row.applicationId} step ${row.emailNumber}) failed: ${message}`,
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

  /** Reset rows wedged in "sending" past the stale-lock window back to scheduled. */
  private async reclaimStaleLocks(): Promise<void> {
    const cutoff = new Date(Date.now() - DripCronService.STALE_LOCK_MS);
    await this.schedules.update(
      { status: "scheduled", lockedAt: null },
      {
        where: {
          status: "sending",
          lockedAt: { [Op.lt]: cutoff },
        },
      },
    );
  }

  private async processRow(row: DripEmailSchedule): Promise<void> {
    const step = row.emailNumber;
    const template = DRIP_TEMPLATES[step];
    if (!template) {
      await row.update({
        status: "skipped",
        lockedAt: null,
        resolution: `No template for step ${step}.`,
      });
      return;
    }

    // Atomic claim: only one caller can flip scheduled -> sending.
    const [claimed] = await this.schedules.update(
      { status: "sending", lockedAt: new Date() },
      { where: { id: row.id, status: "scheduled" } },
    );
    if (claimed === 0) return; // someone else took it

    // drip_email_schedule.applicationId is the LoanApplication UUID.
    const application = await this.applications.findByPk(row.applicationId);
    if (!application) {
      await row.update({
        status: "skipped",
        lockedAt: null,
        resolution: "Loan application not found.",
      });
      return;
    }

    const verification = await this.verifications.findOne({
      where: { applicationId: application.reference },
    });
    if (!verification) {
      await row.update({
        status: "skipped",
        lockedAt: null,
        resolution: "Verification record not found.",
      });
      return;
    }

    await row.increment("attempts");

    // Stop condition: only keep nudging an open, pending verification.
    if (verification.status !== "pending") {
      await row.update({
        status: "skipped",
        lockedAt: null,
        statusAtSend: application.status,
        resolution: `Verification status is ${verification.status}.`,
      });
      this.logger.log(
        `Skipping drip step ${step} for ${application.reference}: verification=${verification.status}.`,
      );
      return;
    }

    if (!verification.verifyToken) {
      await row.update({
        status: "skipped",
        lockedAt: null,
        resolution: "No verify token stored on verification record.",
      });
      this.logger.warn(
        `Drip step ${step} for ${application.reference} skipped: missing verify token.`,
      );
      return;
    }

    const frontendUrl = this.config.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
    const verifyUrl = new URL(
      `/bank-verification/${encodeURIComponent(verification.verifyToken)}`,
      frontendUrl,
    ).toString();
    const ctaHref =
      template.cta.target === "phone" ? `tel:${CONTACT.local.tel}` : verifyUrl;

    try {
      // The final step cancels the application. "withdrawn" is the closest
      // existing loan status to "cancelled".
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

      await row.update({
        status: sent ? "sent" : "skipped",
        sentAt: sent ? new Date() : null,
        statusAtSend: application.status,
        lockedAt: null,
        resolution: sent ? null : "SMTP is not configured.",
      });

      this.logger.log(
        `${sent ? "Sent" : "Skipped"} drip step ${step} (${template.label}) for ${application.reference}.`,
      );
    } catch (error) {
      const resolution =
        error instanceof Error ? error.message : "Unknown email delivery error";
      await row.update({ status: "failed", lockedAt: null, resolution });
      throw error;
    }
  }
}
