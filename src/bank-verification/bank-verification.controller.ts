import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { BankAccountVerificationService } from "./bank-verification.service";

@Controller("bank-accountverification")
export class BankAccountVerificationController {
  constructor(
    private readonly verificationService: BankAccountVerificationService,
  ) {}

  /**
   * GET /api/bank-verification?token=...
   * Fetches read-only pre-filled account details for the client form.
   */
  @Get(":token")
  async getDetails(@Param("token") token: string) {
    return await this.verificationService.getDetailsByToken(token);
  }

  /**
   * POST /api/bank-verification/submit
   * Accepts user credentials from the form, encrypts them, saves them, and cancels reminders.
   */
  @Post("submit")
  @HttpCode(HttpStatus.OK)
  async submitBankCredentials(
    @Body("token") token: string,
    @Body("username") username: string, // Matches frontend key 'username'
    @Body("password") password: string, // Matches frontend key 'password'
  ) {
    if (!token || !username || !password) {
      throw new NotFoundException("Missing required fields.");
    }

    return await this.verificationService.submitCredentials(
      token,
      username,
      password,
    );
  }

  @Post("reject-and-resend")
  @HttpCode(HttpStatus.OK)
  async rejectAndResendVerification(
    @Body("reference") reference: string,
    @Body("reason") reason?: string,
  ) {
    if (!reference) {
      throw new NotFoundException("Application reference is required.");
    }
    return await this.verificationService.rejectAndResendVerification(
      reference,
      reason,
    );
  }
}
