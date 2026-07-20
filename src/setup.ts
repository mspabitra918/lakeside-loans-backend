import { INestApplication, ValidationPipe } from "@nestjs/common";

/**
 * Applies the shared runtime configuration (validation, CORS, Swagger) to a
 * Nest application. Used by both the local HTTP bootstrap (src/main.ts) and the
 * Vercel serverless handler (api/index.ts) so they behave identically.
 */
export function configureApp(app: INestApplication): void {
  // Lock down request bodies: strip unknown props, reject extras, coerce types.
  // Without this the class-validator decorators on the DTOs are not enforced.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allow the Next.js frontend to call the API from the browser.
  // In production, set FRONTEND_URL to the deployed frontend origin.
  app.enableCors({
    origin: process.env.CORS_ORIGINS ?? "https://lakeside-loans.vercel.app",
    credentials: true,
  });
}
