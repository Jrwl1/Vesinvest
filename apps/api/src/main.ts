import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

async function bootstrap() {
  // Immediate startup log (before any Nest initialization)
  console.log(`[Startup] pid=${process.pid} node=${process.version} NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Request logging middleware (runs before CORS)
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // CORS configuration
  const isProd = process.env.NODE_ENV === 'production';
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter((o) => o && o !== '*')
    : [];
  const devOrigins = ['http://localhost:5173', 'http://localhost:3000'];
  const allowedOrigins = isProd ? envOrigins : [...envOrigins, ...devOrigins];

  // Track rejected origins to avoid log spam
  const rejectedOrigins = new Set<string>();

  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
  logger.log(`CORS mode: ${isProd ? 'production' : 'development'}`);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      // Log rejected origin once
      if (!rejectedOrigins.has(origin)) {
        rejectedOrigins.add(origin);
        logger.warn(`CORS rejected origin: ${origin}`);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-demo-key'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 600,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Application running on port ${port} (0.0.0.0)`);
  console.log(`[Startup] READY - listening on 0.0.0.0:${port}`);
}
bootstrap();
