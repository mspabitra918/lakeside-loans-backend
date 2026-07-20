import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Headers,
  Req,
  UseGuards,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { CreateLoanApplicationDto } from "./dto/create-loan-application.dto";
import { LoanApplicationsService } from "./loan-applications.service";
import { getClientIp } from "../utils/get-client-ip";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UserRole } from "../common/enums/user-role.enum";
import { Roles } from "../common/decorators/roles.decorator";
import { EncryptionService } from "src/common/decorators/crypto/encryption.service";

@Controller("loan-applications")
export class LoanApplicationsController {
  constructor(private readonly service: LoanApplicationsService) {}

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

    // Echo back only the reference and state. The response deliberately does
    // NOT contain a decision: nothing has been underwritten at this point, and
    // returning anything approval-shaped here would be a false statement to
    // the applicant.
    return {
      reference: application.reference,
      status: application.status,
      submittedAt: application.createdAt,
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
    @Query("tzOffset") tzOffset?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedTz = tzOffset !== undefined ? Number(tzOffset) : undefined;
    return this.service.getAll({
      date,
      q,
      tzOffset: Number.isFinite(parsedTz) ? parsedTz : undefined,
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
}
