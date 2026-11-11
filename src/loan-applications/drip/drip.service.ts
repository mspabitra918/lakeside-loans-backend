import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { EmailLog } from "../../common/mail/email-log.model";
import { DripEmailSchedule } from "./drip-email-schedule.model";
import { DRIP_TEMPLATES, dripDelaysMs } from "./drip.templates";

/**
 * Schedules and cancels the bank-verification drip sequence.
 *
 * The sequence is entirely DB-driven: this service only writes rows to
 * `drip_email_schedule` (and mirrors them in `email_logs`). A cron
 * (DripCronService) scans those rows and sends due emails. There is no Redis or
 * BullMQ dependency, so a broken queue can no longer hang submissions or stall
 * the drip sequence.
 */
@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);

  constructor(
    @InjectModel(EmailLog) private readonly emailLogs: typeof EmailLog,
    @InjectModel(DripEmailSchedule)
    private readonly schedules: typeof DripEmailSchedule,
  ) {}

  /**
   * Write (or reset) the schedule rows for steps 1..4. The cron picks them up
   * once their `scheduledAt` is due. Idempotent per (application, step).
   */
  async enqueueSequence(
    verificationId: string,
    application: { id: string; reference: string; email: string },
  ) {
    const delays = dripDelaysMs();
    const createdAt = new Date();

    await Promise.all(
      Object.entries(delays).map(async ([step, delay]) => {
        const stepNumber = Number(step);
        const template = DRIP_TEMPLATES[stepNumber];
        const emailType = `bank_verification_drip_step_${stepNumber}`;
        const scheduledAt = new Date(createdAt.getTime() + delay);

        const [schedule, scheduleCreated] = await this.schedules.findOrCreate({
          where: {
            applicationId: application.id,
            emailNumber: stepNumber,
          },
          defaults: {
            applicationId: application.id,
            emailNumber: stepNumber,
            track: "bank-verification",
            scheduledAt,
            status: "scheduled",
          },
        });
        if (!scheduleCreated && schedule.status !== "sent") {
          await schedule.update({
            track: "bank-verification",
            scheduledAt,
            status: "scheduled",
            attempts: 0,
            lockedAt: null,
            sentAt: null,
            statusAtSend: null,
            resolution: null,
          });
        }

        const [log, created] = await this.emailLogs.findOrCreate({
          where: {
            emailType,
            applicationReference: application.reference,
          },
          defaults: {
            emailType,
            recipient: application.email,
            applicationReference: application.reference,
            subject: template.subject,
            status: "pending",
            scheduledAt,
          },
        });
        if (!created && log.status !== "sent") {
          await log.update({
            recipient: application.email,
            subject: template.subject,
            status: "pending",
            scheduledAt,
            sentAt: null,
            errorMessage: null,
          });
        }
      }),
    );

    this.logger.log(
      `Scheduled drip sequence for verification ${verificationId} (${Object.keys(delays).length} steps).`,
    );
  }

  /**
   * Stop the sequence — called the moment verification succeeds. Purely a DB
   * update now; the cron skips anything not in "scheduled" state.
   */
  async cancelSequence(verificationId: string, applicationUuid: string) {
    await this.schedules.update(
      { status: "cancelled", resolution: "Bank verification completed." },
      { where: { applicationId: applicationUuid, status: "scheduled" } },
    );
    this.logger.log(
      `Cancelled drip sequence for verification ${verificationId}.`,
    );
  }
}
