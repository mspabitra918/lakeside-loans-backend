import {
  Column,
  DataType,
  Default,
  Model,
  Table,
} from "sequelize-typescript";

export type DripEmailScheduleStatus =
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "skipped"
  | "failed";

interface DripEmailScheduleCreationAttributes {
  applicationId: string;
  emailNumber: number;
  track: string;
  scheduledAt: Date;
  status?: DripEmailScheduleStatus;
  attempts?: number;
  lockedAt?: Date | null;
  sentAt?: Date | null;
  statusAtSend?: string | null;
  resolution?: string | null;
}

@Table({
  tableName: "drip_email_schedule",
  underscored: true,
  timestamps: true,
})
export class DripEmailSchedule extends Model<
  DripEmailSchedule,
  DripEmailScheduleCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({ type: DataType.UUID, allowNull: false })
  declare applicationId: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare emailNumber: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare track: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare scheduledAt: Date;

  @Default("scheduled")
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare status: DripEmailScheduleStatus;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare attempts: number;

  @Column({ type: DataType.DATE, allowNull: true })
  declare lockedAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare sentAt: Date | null;

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare statusAtSend: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare resolution: string | null;
}
