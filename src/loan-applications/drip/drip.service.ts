import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { dripDelaysMs } from "./drip.templates";

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
 * still boots in environments without a queue — exactly like MailService does
 * when SMTP is absent.
 */
@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);
  private readonly enabled = Boolean(
    process.env.REDIS_URL || process.env.REDIS_HOST,
  );

  constructor(@InjectQueue(DRIP_QUEUE) private readonly queue: Queue) {}

  /** Enqueue steps 1..4 as delayed jobs. Deterministic jobIds make them removable. */
  async enqueueSequence(verificationId: string, verifyToken: string) {
    if (!this.enabled) {
      this.logger.warn(
        `Redis not configured; drip sequence for ${verificationId} was not scheduled.`,
      );
      return;
    }

    const delays = dripDelaysMs();
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
    this.logger.log(`Scheduled drip sequence for verification ${verificationId}.`);
  }

  /** Remove any still-pending drip jobs — called the moment verification succeeds. */
  async cancelSequence(verificationId: string) {
    if (!this.enabled) return;
    await Promise.all(
      [1, 2, 3, 4].map(async (step) => {
        const id = jobId(verificationId, step);
        try {
          const job = await this.queue.getJob(id);
          // Only remove jobs that have not started/finished yet.
          if (job && (await job.isDelayed())) await job.remove();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "unknown error";
          this.logger.warn(`Could not remove drip job ${id}: ${message}`);
        }
      }),
    );
    this.logger.log(`Cancelled drip sequence for verification ${verificationId}.`);
  }
}
