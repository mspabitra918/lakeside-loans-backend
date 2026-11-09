import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { SequelizeModule } from "@nestjs/sequelize";
import { MailService } from "../../common/mail/mail.service";
import { LoanApplication } from "../loan-application.model";
import { DripService, DRIP_QUEUE } from "./drip.service";
import { DripProcessor } from "./drip.processor";
import { BankAccountVerification } from "src/bank-verification/bank-account-verification.model";

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
    };
  }
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: DRIP_QUEUE }),
    SequelizeModule.forFeature([LoanApplication, BankAccountVerification]),
  ],
  providers: [DripService, DripProcessor, MailService],
  exports: [DripService],
})
export class DripModule {}
