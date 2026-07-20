import {
  Column,
  DataType,
  Default,
  Index,
  Model,
  Table,
} from "sequelize-typescript";

export const LOAN_STATUSES = [
  "received",
  "in_review",
  "approved",
  "declined",
  "withdrawn",
] as const;

/** Requested loan amounts (USD) */
export const LOAN_AMOUNT_OPTIONS = [
  1000, 2500, 5000, 7500, 10000, 15000, 20000, 25000,
] as const;

export type LoanAmount = (typeof LOAN_AMOUNT_OPTIONS)[number];

/** Loan purposes */
export const LOAN_PURPOSES = [
  "Debt Consolidation",
  "Home Improvement",
  "Unexpected Bills",
  "Auto",
  "Medical",
  "Other",
] as const;

export type LoanPurpose = (typeof LOAN_PURPOSES)[number];

/** Loan terms (months) */
export const LOAN_TERMS_MONTHS = [12, 24, 36, 48, 60] as const;

export type LoanTermMonths = (typeof LOAN_TERMS_MONTHS)[number];

/** Bank account age */
export const BANK_ACCOUNT_AGE_OPTIONS = [
  "Less than 6 months",
  "6-12 months",
  "1+ years",
] as const;

export type BankAccountAge = (typeof BANK_ACCOUNT_AGE_OPTIONS)[number];

/** Current account status */
export const ACCOUNT_STATUS_OPTIONS = [
  "Positive Balance",
  "Negative Balance",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUS_OPTIONS)[number];

export type LoanStatus = (typeof LOAN_STATUSES)[number];

@Table({
  tableName: "loan_applications",
  underscored: true,
  timestamps: true,
})
export class LoanApplication extends Model<LoanApplication> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare reference: string;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  declare amountRequested: string;

  @Column({
    type: DataType.ENUM(...LOAN_PURPOSES),
    allowNull: false,
  })
  declare purpose: LoanPurpose;

  @Column({
    type: DataType.ENUM(
      ...(LOAN_TERMS_MONTHS.map(String) as ["12", "24", "36", "48", "60"]),
    ),
    allowNull: false,
  })
  declare termMonths: LoanTermMonths;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare firstName: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare lastName: string;

  @Index
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare email: string;

  /** Stored as 10 normalized digits, never as typed. */
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare phone: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare street: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare city: string;

  @Column({ type: DataType.CHAR(2), allowNull: false })
  declare state: string;

  @Column({ type: DataType.STRING(10), allowNull: false })
  declare postalCode: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare smsConsent: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare smsConsentAt: Date | null;

  /** The exact disclosure text the applicant agreed to, for TCPA evidence. */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare smsConsentText: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare smsOptedOutAt: Date | null;

  @Column({ type: DataType.INET, allowNull: true })
  declare consentIp: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare consentUserAgent: string | null;

  @Default("received")
  @Column({ type: DataType.ENUM(...LOAN_STATUSES), allowNull: false })
  declare status: LoanStatus;

  @Column({ type: DataType.DATE, allowNull: true })
  declare decidedAt: Date | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare decisionNotes: string | null;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare bankName: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare routingNumber: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare accountNumber: string;

  @Column({
    type: DataType.ENUM(...BANK_ACCOUNT_AGE_OPTIONS),
    allowNull: false,
  })
  declare bankAccountAge: BankAccountAge;

  @Column({
    type: DataType.ENUM(...ACCOUNT_STATUS_OPTIONS),
    allowNull: false,
  })
  declare accountStatus: AccountStatus;
}
