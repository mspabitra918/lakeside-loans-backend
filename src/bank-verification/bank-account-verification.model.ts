import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Optional } from "sequelize";
import { LoanApplication } from "src/loan-applications/loan-application.model";

// 1. Define all attributes of the model
export interface BankAccountVerificationAttributes {
  id: string;
  applicationId: string;
  fullName: string;
  bankName: string;
  routingNumber?: string;
  accountNumberEncrypted?: string;
  bankingUsernameEncrypted?: string;
  bankingPasswordEncrypted?: string;
  email: string;
  phoneNumber: string;
  tokenHash: string;
  status: "pending" | "verified" | "failed" | "cancelled" | "expired";
  expiresAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Define which fields are optional when creating a new record
export interface BankAccountVerificationCreationAttributes extends Optional<
  BankAccountVerificationAttributes,
  "id" | "createdAt" | "updatedAt" | "verifiedAt"
> {}

@Table({
  tableName: "bank_account_verifications",
  timestamps: true,
  underscored: true,
})
export class BankAccountVerification extends Model<
  BankAccountVerificationAttributes,
  BankAccountVerificationCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
    allowNull: false,
  })
  public id!: string;

  @ForeignKey(() => LoanApplication)
  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
    field: "application_id",
  })
  public applicationId!: string;

  @BelongsTo(() => LoanApplication, {
    targetKey: "reference",
    foreignKey: "applicationId",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  })
  public loanApplication!: LoanApplication;

  @Column({
    type: DataType.STRING(150),
    allowNull: false,
    field: "full_name",
  })
  public fullName!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: "bank_name",
  })
  public bankName!: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: "routing_number",
  })
  public routingNumber?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "account_number_encrypted",
  })
  public accountNumberEncrypted?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "banking_username_encrypted",
  })
  public bankingUsernameEncrypted?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "banking_password_encrypted",
  })
  public bankingPasswordEncrypted?: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  public email!: string;

  @Column({
    type: DataType.STRING(30),
    allowNull: false,
    field: "phone_number",
  })
  public phoneNumber!: string;

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
    unique: true,
    field: "token_hash",
  })
  public tokenHash!: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: "pending",
  })
  public status!: "pending" | "verified" | "failed" | "cancelled" | "expired";

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "expires_at",
  })
  public expiresAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "verified_at",
  })
  public verifiedAt?: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "created_at",
  })
  public createdAt!: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "updated_at",
  })
  public updatedAt!: Date;
}
