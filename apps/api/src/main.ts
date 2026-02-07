import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';
import { isDemoModeEnabled } from './demo/demo.constants';

async function bootstrap() {
  // Immediate startup log (before any Nest initialization)
  console.log(`[Startup] pid=${process.pid} node=${process.version} NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Handle CORS preflight (OPTIONS) before route matching so OPTIONS never 404
  const isProd = process.env.NODE_ENV === 'production';
  const isDemo = isDemoModeEnabled();
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

  /**
   * Dynamic origin check: returns true if the origin should be allowed.
   *
   * In demo mode (non-production only), ANY origin is accepted so that
   * Cloudflare quick-tunnels (*.trycloudflare.com) work without manual CORS.
   * In non-demo dev, *.trycloudflare.com is always allowed so the frontend
   * tunnel (e.g. harrison-showtimes.trycloudflare.com) can call the API
   * tunnel (e.g. classifieds-intellectual.trycloudflare.com). Production
   * is unchanged (only envOrigins).
   */
  const trycloudflareRegex = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
  function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true; // curl, server-to-server
    if (preflightOrigins.includes(origin)) return true;
    if (isDemo) return true; // Demo mode: allow all (safe — never in production)
    if (!isProd && trycloudflareRegex.test(origin)) return true;
    return false;
  }

  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      if (isOriginAllowed(origin) && origin) {
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

  // Track rejected origins to avoid log spam
  const rejectedOrigins = new Set<string>();

  const allowedHeaders = ['Content-Type', 'Authorization', 'Accept', 'x-demo-key'];

  if (isProd) {
    logger.log(`CORS allowed origins: ${preflightOrigins.join(', ') || '(none)'}`);
  } else {
    logger.log(`CORS dev origins: ${devOrigins.join(', ')}`);
    if (isDemo) {
      logger.log('CORS demo mode: accepting ALL origins (safe — non-production only)');
    } else {
      logger.log('CORS tunnel support: *.trycloudflare.com accepted in dev');
    }
  }
  logger.log(`CORS allowed headers: ${allowedHeaders.join(', ')}`);

  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, origin || true);
      }
      // Log rejected origin once
      if (origin && !rejectedOrigins.has(origin)) {
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
