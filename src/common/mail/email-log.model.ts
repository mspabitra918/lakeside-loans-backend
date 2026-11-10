import {
  Column,
  DataType,
  Default,
  Model,
  Table,
} from "sequelize-typescript";

export type EmailDeliveryStatus = "pending" | "sent" | "failed" | "skipped";
interface EmailLogCreationAttributes {
  emailType: string;
  recipient: string;
  subject: string;
  applicationReference?: string | null;
  status?: EmailDeliveryStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
}

@Table({
  tableName: "email_logs",
  underscored: true,
  timestamps: true,
})
export class EmailLog extends Model<EmailLog, EmailLogCreationAttributes> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare emailType: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare recipient: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare applicationReference: string | null;

  @Column({ type: DataType.STRING(500), allowNull: false })
  declare subject: string;

  @Default("pending")
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare status: EmailDeliveryStatus;

  @Column({ type: DataType.STRING(500), allowNull: true })
  declare providerMessageId: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare errorMessage: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare scheduledAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare sentAt: Date | null;
}
