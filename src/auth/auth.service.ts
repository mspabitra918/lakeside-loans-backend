import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { UserRole } from "../common/enums/user-role.enum";
import { UserService } from "../user/users.service";
import { CreateUserDto } from "../user/dto/create-user.dto";
import { LoginDto } from "../user/dto/login.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto) {
    try {
      const user = await this.userService.create({
        ...dto,
        role: dto.role,
      });
      const token = this.signToken(user.id, user.email, user.role);
      return {
        message: "Registration successful",
        data: {
          token,
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
          },
        },
      };
    } catch (err) {
      this.logger.error("register failed", err);
      throw err;
    }
  }

  async login(dto: LoginDto) {
    try {
      const user = await this.userService.findByEmail(dto.email);
      if (!user) throw new UnauthorizedException("Invalid credentials");

      const valid = await bcrypt.compare(dto.password, user.password);
      if (!valid) throw new UnauthorizedException("Invalid credentials");

      const token = this.signToken(user.id, user.email, user.role);
      return {
        message: "Login successful",
        data: {
          token,
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
          },
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error("login failed", err);
      throw new InternalServerErrorException("Login failed");
    }
  }

  private signToken(
    sub: string,
    email: string,
    role: UserRole.ADMIN | UserRole.USER,
  ) {
    try {
      return this.jwtService.sign({ sub, email, role });
    } catch (err) {
      this.logger.error("signToken failed", err);
      throw new InternalServerErrorException("Token generation failed");
    }
  }
}
