import { Column, DataType, Default, Model, Table } from "sequelize-typescript";

@Table({
  tableName: "bank_verification_requests",
  underscored: true,
  timestamps: false,
})
export class BankVerificationRequest extends Model<BankVerificationRequest> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare applicationId: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare type: "initial" | "reverification";

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare completedAt: Date | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare outcome: "verified" | "needs_reverification" | null;
}
