import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SequelizeModule } from "@nestjs/sequelize";
import { LoanApplicationsModule } from "./loan-applications/loan-applications.module";
import { LoanApplication } from "./loan-applications/loan-application.model";
import { CryptoModule } from "./common/decorators/crypto/crypto.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { UserModule } from "./user/users.module";
import { User } from "./user/models/user.model";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: "postgres" as const,
        host: config.get<string>("DB_HOST", "127.0.0.1"),
        port: Number(config.get<string>("DB_PORT", "5432")),
        username: config.get<string>("DB_USERNAME", "postgres"),
        password: config.get<string>("DB_PASSWORD") || undefined,
        database: config.get<string>("DB_NAME", "lakeside_loans"),
        // autoLoadModels is off, so every model a feature module pulls in with
        // forFeature must be registered on the connection here too.
        models: [LoanApplication, User],

        // Schema is owned by the migrations in `database/migrations`. Letting
        // Sequelize sync would let the running app silently diverge from the
        // migration history and mutate columns holding real applicant data.
        synchronize: false,
        autoLoadModels: false,

        logging: config.get("NODE_ENV") === "production" ? false : console.log,

        dialectOptions:
          config.get<string>("DB_SSL") === "true"
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : {},
      }),
    }),

    LoanApplicationsModule,
    CryptoModule,
    UserModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
