import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Ip,
  Param,
  Post,
  Headers,
  Req,
  UseGuards,
  Query,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateLoanApplicationDto } from "./dto/create-loan-application.dto";
import { LoanApplicationsService } from "./loan-applications.service";
import { getClientIp } from "../utils/get-client-ip";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UserRole } from "../common/enums/user-role.enum";
import { Roles } from "../common/decorators/roles.decorator";
import { BankVerificationService } from "./bank-verification.service";
import { MailService } from "../common/mail/mail.service";

@Controller("loan-applications")
export class LoanApplicationsController {
  private readonly logger = new Logger(LoanApplicationsController.name);

  constructor(
    private readonly service: LoanApplicationsService,
    private readonly bankVerificationService: BankVerificationService,
    private readonly mail: MailService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: any,
    @Body() dto: CreateLoanApplicationDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    const ipAddress = getClientIp(req);
    const application = await this.service.create(dto, {
      ipAddress,
      userAgent,
    });

    let confirmationEmailSent = false;
    try {
      confirmationEmailSent = await this.mail.sendApplicationSubmittedEmail({
        to: application.email,
        applicantName: application.firstName,
        reference: application.reference,
        status: application.status,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown email delivery error";
      this.logger.error(
        `Application ${application.reference} was saved, but its confirmation email could not be sent: ${message}`,
      );
    }

    // Echo back only the reference and state. The response deliberately does
    // NOT contain a decision: nothing has been underwritten at this point, and
    // returning anything approval-shaped here would be a false statement to
    // the applicant.
    return {
      reference: application.reference,
      status: application.status,
      submittedAt: application.createdAt,
      confirmationEmailSent,
    };
  }

  /**
   * Status lookup for an applicant who has their reference.
   *
   * Returns status only. A reference is a bearer token in practice — anyone
   * who has it can call this — so the payload must never include name, email,
   * address, or phone. Adding PII here would turn a support convenience into
   * an enumeration target.
   */
  @Get(":reference/status")
  async status(@Param("reference") reference: string) {
    const application = await this.service.findByReference(reference);

    return {
      reference: application.reference,
      status: application.status,
      submittedAt: application.createdAt,
    };
  }

  @Get("applications")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllApplications(
    @Query("date") date?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.getAll({
      date,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("applications/:reference/admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getByIdAdminAccess(@Param("reference") reference: string) {
    const loan = await this.service.getByIdAdminAccess(reference);
    if (!loan) throw new NotFoundException("Loan application not found");
    return { loan };
  }

  @Post("applications/:reference/bank-verification-email")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendBankVerificationEmail(
    @Param("reference") reference: string,
    @Body() body: { type: "initial" | "reverification" },
  ) {
    if (!["initial", "reverification"].includes(body?.type)) {
      throw new BadRequestException(
        'type must be "initial" or "reverification"',
      );
    }

    return this.bankVerificationService.sendVerificationEmail(
      reference,
      body.type,
    );
  }
}
