import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { LoanApplicationsController } from "./loan-applications.controller";
import { LoanApplicationsService } from "./loan-applications.service";
import { LoanApplication } from "./loan-application.model";
import { BankVerificationRequest } from "./bank-verification-request.model";
import { BankVerificationController } from "./bank-verification.controller";
import { BankVerificationService } from "./bank-verification.service";
import { MailService } from "../common/mail/mail.service";
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
  ],
  controllers: [LoanApplicationsController, BankVerificationController],
  providers: [
    LoanApplicationsService,
    BankVerificationService,
    MailService,
  ],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
