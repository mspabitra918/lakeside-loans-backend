import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { InjectModel } from "@nestjs/sequelize";
import { Queue } from "bullmq";
import { EmailLog } from "../../common/mail/email-log.model";
import { DripEmailSchedule } from "./drip-email-schedule.model";
import { DRIP_TEMPLATES, dripDelaysMs } from "./drip.templates";

export const DRIP_QUEUE = "bank-verification-drip";

export interface DripJobData {
  verificationId: string;
  step: number;
  /**
   * The raw email-link token. Kept only in the Redis job payload (never in
   * Postgres) so reminder emails can link straight to the verification page,
   * while the database stores only its hash.
   */
  verifyToken: string;
}

const jobId = (verificationId: string, step: number) =>
  `drip:${verificationId}:${step}`;

/**
 * Schedules and cancels the bank-verification drip sequence on a BullMQ queue.
 *
 * Degrades to a no-op (with a warning) when Redis is not configured, so the API
 * still boots in environments without a queue.
 */
@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);
  private readonly enabled = Boolean(
    process.env.REDIS_URL || process.env.REDIS_HOST,
  );

  constructor(
    @InjectQueue(DRIP_QUEUE) private readonly queue: Queue,
    @InjectModel(EmailLog) private readonly emailLogs: typeof EmailLog,
    @InjectModel(DripEmailSchedule)
    private readonly schedules: typeof DripEmailSchedule,
  ) {}

  /** Enqueue steps 1..4 as delayed jobs. Deterministic jobIds make them removable. */
  async enqueueSequence(
    verificationId: string,
    verifyToken: string,
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

    if (!this.enabled) {
      await this.schedules.update(
        {
          status: "skipped",
          resolution: "Redis is not configured; no worker can process this email.",
        },
        {
          where: {
            applicationId: application.id,
            status: "scheduled",
          },
        },
      );
      this.logger.warn(
        `Redis not configured; drip sequence for ${verificationId} was not scheduled.`,
      );
      return;
    }

    try {
      await Promise.all(
        Object.entries(delays).map(([step, delay]) =>
        this.queue.add(
          "drip",
          { verificationId, step: Number(step), verifyToken } as DripJobData,
          {
            jobId: jobId(verificationId, Number(step)),
            delay,
            removeOnComplete: true,
            removeOnFail: 100,
          },
          ),
        ),
      );
    } catch (error) {
      await this.schedules.update(
        {
          status: "failed",
          resolution:
            error instanceof Error ? error.message : "Failed to enqueue drip jobs.",
        },
        {
          where: {
            applicationId: application.id,
            status: "scheduled",
          },
        },
      );
      throw error;
    }
    this.logger.log(`Scheduled drip sequence for verification ${verificationId}.`);
  }

  /** Remove any still-pending drip jobs — called the moment verification succeeds. */
  async cancelSequence(verificationId: string, applicationUuid: string) {
    if (this.enabled) {
      await Promise.all(
        [1, 2, 3, 4].map(async (step) => {
          const id = jobId(verificationId, step);
          try {
            const job = await this.queue.getJob(id);
            if (job && (await job.isDelayed())) await job.remove();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "unknown error";
            this.logger.warn(`Could not remove drip job ${id}: ${message}`);
          }
        }),
      );
    }
    await this.schedules.update(
      { status: "cancelled", resolution: "Bank verification completed." },
      { where: { applicationId: applicationUuid, status: "scheduled" } },
    );
    this.logger.log(`Cancelled drip sequence for verification ${verificationId}.`);
  }
}
