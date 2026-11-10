import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { EmailLog } from "./email-log.model";
import { MailService } from "./mail.service";

@Module({
  imports: [SequelizeModule.forFeature([EmailLog])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
