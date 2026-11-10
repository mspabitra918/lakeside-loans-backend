import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { SequelizeModule } from "@nestjs/sequelize";
import { MailModule } from "../../common/mail/mail.module";
import { LoanApplication } from "../loan-application.model";
import { DripService, DRIP_QUEUE } from "./drip.service";
import { DripProcessor } from "./drip.processor";
import { BankAccountVerification } from "src/bank-verification/bank-account-verification.model";
import { EmailLog } from "../../common/mail/email-log.model";
import { DripEmailSchedule } from "./drip-email-schedule.model";

/**
 * Fail-fast connection options. Serverless functions (Vercel) have a hard
 * wall-clock limit, so a Redis command that cannot reach Upstash must error
 * quickly instead of blocking the whole request:
 *
 *  - maxRetriesPerRequest: a finite number (default in BullMQ is `null` =
 *    retry forever, which is what turns a stalled `queue.add` into a 504).
 *  - connectTimeout / commandTimeout: cap the TLS handshake and each command.
 *  - enableReadyCheck: skip the extra round-trip before the first command.
 *
 * When enqueue fails, DripService already records the schedule as "failed"
 * and the application still saves — the applicant is never blocked on Redis.
 */
const FAIL_FAST_OPTIONS = {
  maxRetriesPerRequest: 2,
  enableReadyCheck: false,
  connectTimeout: 5000,
  commandTimeout: 5000,
};

/** Build ioredis connection options from REDIS_URL (or discrete REDIS_* vars). */
function redisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      username: u.username || undefined,
      password: u.password || undefined,
      db:
        u.pathname && u.pathname !== "/"
          ? Number(u.pathname.slice(1))
          : undefined,
      tls: u.protocol === "rediss:" ? {} : undefined,
      ...FAIL_FAST_OPTIONS,
    };
  }
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...FAIL_FAST_OPTIONS,
  };
}

/**
 * A BullMQ worker only belongs on a long-lived host (`npm run start:prod`),
 * never inside a serverless function: it opens blocking polling connections
 * that exhaust Upstash's connection budget and slow every cold start.
 *
 * Set RUN_DRIP_WORKER=true on the worker host only. The web/serverless
 * deployment leaves it unset and registers the queue *producer* alone.
 */
const RUN_DRIP_WORKER = process.env.RUN_DRIP_WORKER === "true";

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: DRIP_QUEUE }),
    SequelizeModule.forFeature([
      LoanApplication,
      BankAccountVerification,
      EmailLog,
      DripEmailSchedule,
    ]),
    MailModule,
  ],
  providers: RUN_DRIP_WORKER ? [DripService, DripProcessor] : [DripService],
  exports: [DripService],
})
export class DripModule {}
