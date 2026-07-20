import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import * as bcrypt from "bcryptjs";
import { User } from "./models/user.model";
import { UserRole } from "../common/enums/user-role.enum";

export interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  role?: UserRole;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  async create(input: CreateUserInput): Promise<User> {
    try {
      const existing = await this.userModel.findOne({
        where: { email: input.email },
      });
      if (existing) {
        throw new ConflictException("Email already registered");
      }
      const hashed = await bcrypt.hash(input.password, 10);
      const user = await this.userModel.create({
        ...input,
        password: hashed,
      } as any);
      return user;
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      this.logger.error("UserService.create failed");
      throw new InternalServerErrorException("Could not create user");
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.userModel.findOne({ where: { email } });
    } catch (err) {
      this.logger.error("UserService.findByEmail failed", err);
      throw new InternalServerErrorException("Lookup failed");
    }
  }

  async findById(id: string): Promise<User> {
    try {
      const user = await this.userModel.findByPk(id);
      if (!user) throw new NotFoundException("User not found");
      return user;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error("UserService.findById failed", err);
      throw new InternalServerErrorException("Lookup failed");
    }
  }
}
