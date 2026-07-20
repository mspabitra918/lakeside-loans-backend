import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { LoanApplicationsService } from "../loan-applications/loan-applications.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly loans: LoanApplicationsService) {}

  // Totals for the admin dashboard cards.
  @Get("stats")
  async stats() {
    const [applications] = await Promise.all([this.loans.countAll()]);
    return { applications };
  }
}
