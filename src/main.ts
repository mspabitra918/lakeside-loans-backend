import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./setup";

// Local / long-running HTTP bootstrap. On Vercel the app is served through the
// serverless handler in api/index.ts instead, which reuses configureApp().
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  console.log(`Swagger running at: http://localhost:${port}/api-docs`);
}

bootstrap();
