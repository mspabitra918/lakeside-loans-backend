import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UserRole } from "../../common/enums/user-role.enum";

export interface JwtPayload {
  sub: string;
  email: string;
  // Tokens are signed with the user's actual admin tier (see AuthService);
  // this must match the UserRole the RolesGuard checks against.
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "change_this_super_secret"),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub) throw new UnauthorizedException("Invalid token");
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
