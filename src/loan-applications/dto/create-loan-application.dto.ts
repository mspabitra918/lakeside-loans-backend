import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const LOAN_PURPOSES = [
  "Debt Consolidation",
  "Home Improvement",
  "Unexpected Bills",
  "Auto",
  "Medical",
  "Other",
] as const;

export const LOAN_TERMS_MONTHS = [12, 24, 36, 48, 60] as const;

export const MIN_LOAN_AMOUNT = 1_000;
export const MAX_LOAN_AMOUNT = 25_000;

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const digitsOnly = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.replace(/\D/g, "") : value;

export class CreateLoanApplicationDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_LOAN_AMOUNT)
  @Max(MAX_LOAN_AMOUNT)
  amountRequested!: number;

  @IsIn(LOAN_PURPOSES as readonly string[])
  purpose!: string;

  @IsInt()
  @IsIn(LOAN_TERMS_MONTHS as readonly number[])
  termMonths!: number;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @Transform(trim)
  @IsEmail({}, { message: "email must be a valid email address" })
  @MaxLength(255)
  email!: string;

  /** Accepts any punctuation; normalized to 10 digits before validation. */
  @Transform(digitsOnly)
  @Matches(/^[2-9]\d{9}$/, {
    message: "phone must be a 10-digit US number",
  })
  phone!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 255)
  street!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  city!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, { message: "state must be a 2-letter code" })
  state!: string;

  @Transform(digitsOnly)
  @Matches(/^(\d{5}|\d{9})$/, { message: "postalCode must be 5 or 9 digits" })
  postalCode!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  bankName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  routingNumber!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  accountNumber!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  bankAccountAge!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  accountStatus!: string;

  /**
   * Optional by design. The disclosure states consent is not a condition of
   * obtaining a loan, so the API must accept an application without it.
   */
  @IsOptional()
  @IsBoolean()
  smsConsent?: boolean;

  /** The disclosure text as rendered to this applicant, retained as evidence. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  smsConsentText?: string;
}
