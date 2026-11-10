import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { BankAccountVerificationService } from "./bank-verification.service";
import { BankAccountVerificationController } from "./bank-verification.controller";
import { DripModule } from "src/loan-applications/drip/drip.module";
import { BankAccountVerification } from "./bank-account-verification.model";
import { LoanApplication } from "src/loan-applications/loan-application.model";
import { MailModule } from "src/common/mail/mail.module";

@Module({
  imports: [
    SequelizeModule.forFeature([BankAccountVerification, LoanApplication]), // <-- REQUIRED for initialization
    DripModule,
    MailModule,
  ],
  providers: [BankAccountVerificationService],
  controllers: [BankAccountVerificationController],
  exports: [BankAccountVerificationService],
})
export class BankAccountVerificationModule {}
