import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  declare email: string;

  @IsString()
  @MinLength(6)
  declare password: string;
}
