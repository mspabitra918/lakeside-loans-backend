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
 * ioredis options shared by the queue producer and the worker.
 *
 *  - maxRetriesPerRequest: MUST be `null` — BullMQ requires it for its blocking
 *    worker commands, and will refuse to run a Worker otherwise.
 *  - enableReadyCheck: false skips an extra round-trip before the first command.
 *  - connectTimeout caps the initial TCP/TLS handshake. (We deliberately do NOT
 *    set commandTimeout: it would abort BullMQ's long-lived blocking reads.)
 *
 * Fail-fast on the request path is no longer needed here: the submission
 * response is sent before any enqueue runs, and DripService already records a
 * failed enqueue without blocking anything.
 */
const BULLMQ_CONNECTION_OPTIONS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 10000,
};

/**
 * Build ioredis connection options from REDIS_URL (or discrete REDIS_* vars).
 *
 * `new URL()` returns `username`/`password` still percent-encoded, so they must
 * be decoded — otherwise a password like `Mspabitra1@Redis`, written in the URL
 * as `...%40Redis`, authenticates with the literal `%40` and Redis rejects it
 * (the NOAUTH/HELLO error).
 */
function redisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      db:
        u.pathname && u.pathname !== "/"
          ? Number(u.pathname.slice(1))
          : undefined,
      tls: u.protocol === "rediss:" ? {} : undefined,
      ...BULLMQ_CONNECTION_OPTIONS,
    };
  }
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...BULLMQ_CONNECTION_OPTIONS,
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
