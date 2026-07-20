// users/models/user.model.ts

import { Table, Column, Model, DataType } from "sequelize-typescript";
import { UserRole } from "../../common/enums/user-role.enum";

@Table({
  tableName: "users",
  underscored: true,
})
export class User extends Model<User> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column
  declare full_name: string;

  @Column({
    unique: true,
  })
  declare email: string;

  @Column
  declare password: string;

  @Column({
    type: DataType.ENUM(...Object.values(UserRole)),
    defaultValue: UserRole.ADMIN,
  })
  declare role: UserRole;

  @Column({
    defaultValue: true,
  })
  declare is_active: boolean;
}
