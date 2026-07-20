import * as pg from "pg";
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
      useFactory: (config: ConfigService) => {
        // Managed Postgres (and the migrations in database/config.js) supply a
        // single DATABASE_URL. Prefer it when set, since on a host like Vercel
        // the discrete DB_* vars are absent and the defaults below would
        // silently dial 127.0.0.1.
        const url = config.get<string>("DATABASE_URL");

        return {
          dialect: "postgres" as const,

          // Sequelize otherwise reaches the driver through a dynamic
          // `require("pg")`, which Vercel's dependency tracer cannot see — so
          // pg is left out of the deployed bundle and the connection fails at
          // runtime with "Please install pg package manually". Handing it over
          // explicitly keeps the reference static and traceable.
          dialectModule: pg,
          ...(url
            ? { uri: url }
            : {
                host: config.get<string>("DB_HOST", "127.0.0.1"),
                port: Number(config.get<string>("DB_PORT", "5432")),
                username: config.get<string>("DB_USERNAME", "postgres"),
                password: config.get<string>("DB_PASSWORD") || undefined,
                database: config.get<string>("DB_NAME", "lakeside_loans"),
              }),
          // autoLoadModels is off, so every model a feature module pulls in
          // with forFeature must be registered on the connection here too.
          models: [LoanApplication, User],

          // Schema is owned by the migrations in `database/migrations`. Letting
          // Sequelize sync would let the running app silently diverge from the
          // migration history and mutate columns holding real applicant data.
          synchronize: false,
          autoLoadModels: false,

          logging:
            config.get("NODE_ENV") === "production" ? false : console.log,

          // Each serverless invocation may land on a cold container, so keep
          // the pool small and let idle connections go rather than exhausting
          // the database's connection limit across many warm containers.
          pool: { max: 2, min: 0, idle: 10_000, acquire: 30_000 },

          dialectOptions:
            config.get<string>("DB_SSL") === "true"
              ? { ssl: { require: true, rejectUnauthorized: false } }
              : {},
        };
      },
    }),

    LoanApplicationsModule,
    CryptoModule,
    UserModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
