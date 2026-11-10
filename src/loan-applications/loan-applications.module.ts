import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { LoanApplicationsController } from "./loan-applications.controller";
import { LoanApplicationsService } from "./loan-applications.service";
import { LoanApplication } from "./loan-application.model";
import { BankVerificationRequest } from "./bank-verification-request.model";
import { BankVerificationController } from "./bank-verification.controller";
import { BankVerificationService } from "./bank-verification.service";
import { MailModule } from "../common/mail/mail.module";
import { BankAccountVerification } from "src/bank-verification/bank-account-verification.model";
import { BankAccountVerificationModule } from "src/bank-verification/bank-verification.module";

@Module({
  imports: [
    SequelizeModule.forFeature([
      LoanApplication,
      BankVerificationRequest,
      BankAccountVerification,
    ]),
    BankAccountVerificationModule,
    MailModule,
  ],
  controllers: [LoanApplicationsController, BankVerificationController],
  providers: [
    LoanApplicationsService,
    BankVerificationService,
  ],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
