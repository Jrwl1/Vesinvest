import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

async function bootstrap() {
  // Immediate startup log (before any Nest initialization)
  console.log(`[Startup] pid=${process.pid} node=${process.version} NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Handle CORS preflight (OPTIONS) before route matching so OPTIONS never 404
  const isProd = process.env.NODE_ENV === 'production';
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter((o) => o && o !== '*')
    : [];
  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
  ];
  const preflightOrigins = isProd ? envOrigins : [...envOrigins, ...devOrigins];

  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      const allowed = !origin || preflightOrigins.includes(origin);
      if (origin && allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, x-demo-key',
      );
      res.setHeader('Access-Control-Max-Age', '600');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.status(204).end();
      return;
    }
    next();
  });

  // Request logging middleware (runs before CORS)
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // CORS configuration (for non-OPTIONS requests)
  const allowedOrigins = isProd ? envOrigins : [...envOrigins, ...devOrigins];

  // Track rejected origins to avoid log spam
  const rejectedOrigins = new Set<string>();

  const allowedHeaders = ['Content-Type', 'Authorization', 'Accept', 'x-demo-key'];

  if (isProd) {
    logger.log(`CORS allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
  } else {
    logger.log(`CORS dev origins: ${devOrigins.join(', ')}`);
  }
  logger.log(`CORS allowed headers: ${allowedHeaders.join(', ')}`);
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
    allowedHeaders: allowedHeaders,
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 600,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = Number(process.env.PORT || 3000);
  if (!process.env.PORT) {
    logger.warn('PORT not set, defaulting to 3000');
  }
  await app.listen(port, '0.0.0.0');
  logger.log(`Listening on 0.0.0.0:${port}`);
  console.log(`[Startup] READY - listening on 0.0.0.0:${port}`);
}
bootstrap();
