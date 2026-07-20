// users/dto/create-user.dto.ts

import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { UserRole } from "../../common/enums/user-role.enum";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  declare full_name: string;

  @IsEmail()
  declare email: string;

  @IsString()
  declare password: string;

  @IsString()
  declare role: UserRole;
}
