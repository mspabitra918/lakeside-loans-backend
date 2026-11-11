import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { MailModule } from "../../common/mail/mail.module";
import { LoanApplication } from "../loan-application.model";
import { DripService } from "./drip.service";
import { DripCronService } from "./drip.cron";
import { BankAccountVerification } from "src/bank-verification/bank-account-verification.model";
import { EmailLog } from "../../common/mail/email-log.model";
import { DripEmailSchedule } from "./drip-email-schedule.model";

/**
 * Bank-verification drip sequence — fully DB-driven.
 *
 * DripService writes schedule rows; DripCronService (a @nestjs/schedule cron)
 * scans and sends due rows every minute. No Redis / BullMQ: the queue used to
 * hang submissions and stall the sequence whenever Redis auth failed.
 *
 * ScheduleModule.forRoot() is registered once in AppModule.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      LoanApplication,
      BankAccountVerification,
      EmailLog,
      DripEmailSchedule,
    ]),
    MailModule,
  ],
  providers: [DripService, DripCronService],
  exports: [DripService],
})
export class DripModule {}
