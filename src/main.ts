import { createApp } from './bootstrap';

async function bootstrap() {
  const app = await createApp();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
