import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./setup";

// Local / long-running HTTP bootstrap. On Vercel the app is served through the
// serverless handler in api/index.ts instead, which reuses configureApp().
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Handle root path directly
  app.use("/", (req: any, res: any, next: () => void) => {
    if (req.path === "/") {
      return res.send("ZippyCash backend is connected");
    }
    next();
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  console.log(`ZippyCash backend listening on port: ${port}`);
  console.log(`Swagger running at: http://localhost:${port}/api-docs`);
}

bootstrap();
