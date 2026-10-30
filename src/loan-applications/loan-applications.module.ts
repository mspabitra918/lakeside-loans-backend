import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LoanApplicationsController } from './loan-applications.controller';
import { LoanApplicationsService } from './loan-applications.service';
import { LoanApplication } from './loan-application.model';
import { BankVerificationRequest } from './bank-verification-request.model';
import { BankVerificationController } from './bank-verification.controller';
import { BankVerificationService } from './bank-verification.service';
import { MailService } from '../common/mail/mail.service';

@Module({
  imports: [SequelizeModule.forFeature([LoanApplication, BankVerificationRequest])],
  controllers: [LoanApplicationsController, BankVerificationController],
  providers: [LoanApplicationsService, BankVerificationService, MailService],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
