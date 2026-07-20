import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { LoanApplicationsModule } from "../loan-applications/loan-applications.module";

@Module({
  imports: [LoanApplicationsModule],
  controllers: [AdminController],
})
export class AdminModule {}
