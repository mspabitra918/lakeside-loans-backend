import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { BankVerificationService } from "./bank-verification.service";

@Controller("bank-verification")
export class BankVerificationController {
  constructor(private readonly service: BankVerificationService) {}

  @Get(":token")
  getApplicantDetails(@Param("token") token: string) {
    return this.service.getApplicantDetails(token);
  }

  @Post(":token/complete")
  completeDemo(
    @Param("token") token: string,
    @Body() body: { outcome: "verified" | "needs_reverification" },
  ) {
    return this.service.completeDemo(token, body?.outcome);
  }

  @Post(":token/submit")
  submitBankDetails(
    @Param("token") token: string,
    @Body() body: { bankUsername: string; bankPassword: string },
  ) {
    return this.service.submitBankDetails(
      token,
      body?.bankUsername,
      body?.bankPassword,
    );
  }
}
