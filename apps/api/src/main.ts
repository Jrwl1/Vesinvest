import { Logger,ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction,Request,Response } from 'express';
import helmet from 'helmet';
import {
  getAppModeReason,
  resolveAppModeFromEnv,
} from './app-mode/app-mode.constants';
import { AppModule } from './app.module';
import { resolveAuthRateLimitMode } from './auth/rate-limit-contract';
import { LegalService } from './legal/legal.service';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

function validateRuntimeEnv(logger: Logger, appMode: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const authRateLimitMode = resolveAuthRateLimitMode();
  const authBypass = process.env.AUTH_BYPASS === 'true';
  const authBypassKey = process.env.AUTH_BYPASS_KEY?.trim();
  const authEdgeRateLimitSecret =
    process.env.AUTH_EDGE_RATE_LIMIT_SECRET?.trim();
  const missing: string[] = [];
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

  if (isProd && appMode !== 'internal_demo') {
    if (!process.env.LEGAL_TERMS_VERSION) missing.push('LEGAL_TERMS_VERSION');
    if (!process.env.LEGAL_DPA_VERSION) missing.push('LEGAL_DPA_VERSION');
  } else {
    if (!process.env.LEGAL_TERMS_VERSION) {
      logger.warn(
        'LEGAL_TERMS_VERSION not set; using development fallback "v1"',
      );
    }
    if (!process.env.LEGAL_DPA_VERSION) {
      logger.warn('LEGAL_DPA_VERSION not set; using development fallback "v1"');
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (databaseUrl && !/^(postgresql|postgres|prisma):\/\//.test(databaseUrl)) {
    throw new Error(
      'DATABASE_URL must start with postgresql://, postgres://, or prisma://',
    );
  }

  if (process.env.NODE_ENV === 'production' && appMode === 'internal_demo') {
    throw new Error('APP_MODE=internal_demo is not allowed in production');
  }

  if (isProd && authBypass) {
    throw new Error('AUTH_BYPASS=true is not allowed in production');
  }

  if (isProd && authRateLimitMode !== 'edge') {
    throw new Error(
      'Production requires AUTH_RATE_LIMIT_MODE=edge with trusted edge-backed auth throttling.',
    );
  }

  if (authRateLimitMode === 'edge' && !authEdgeRateLimitSecret) {
    throw new Error(
      'AUTH_RATE_LIMIT_MODE=edge requires AUTH_EDGE_RATE_LIMIT_SECRET.',
    );
  }

  if (authBypass && appMode !== 'internal_demo') {
    throw new Error('AUTH_BYPASS=true requires APP_MODE=internal_demo');
  }

  if (authBypass && !authBypassKey) {
    throw new Error('AUTH_BYPASS=true requires AUTH_BYPASS_KEY');
  }

  if (!process.env.APP_MODE) {
    logger.warn(`APP_MODE not set; resolved fallback mode="${appMode}"`);
  }
}

function resolveTrustProxySetting(
  value: string | undefined,
): boolean | number | string | string[] {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === 'false') {
    return false;
  }
  if (normalized.toLowerCase() === 'true') {
    return true;
  }
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  const entries = normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length <= 1) {
    return entries[0] ?? false;
  }
  return entries;
}

function formatTrustProxySetting(
  value: boolean | number | string | string[],
): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

async function bootstrap() {
  // Immediate startup log (before any Nest initialization)
  console.log(
    `[Startup] pid=${process.pid} node=${process.version} NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`,
  );

  const logger = new Logger('Bootstrap');
  const appMode = resolveAppModeFromEnv();
  const appModeReason = getAppModeReason();
  validateRuntimeEnv(logger, appMode);
  logger.log(`APP_MODE=${appMode} (${appModeReason.reason})`);
  logger.log(`AUTH_RATE_LIMIT_MODE=${resolveAuthRateLimitMode()}`);
  const app = await NestFactory.create(AppModule);
  try {
    await app.get(LegalService).ensureCurrentDocuments();
  } catch (error) {
    logger.warn(
      `Legal document sync deferred until DB is ready: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const trustProxy = resolveTrustProxySetting(process.env.TRUST_PROXY);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxy);
  logger.log(`Express trust proxy: ${formatTrustProxySetting(trustProxy)}`);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Handle CORS preflight (OPTIONS) before route matching so OPTIONS never 404
  const isProd = process.env.NODE_ENV === 'production';
  const isDemo = appMode === 'internal_demo';
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter((o) => o && o !== '*')
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      if (isOriginAllowed(origin) && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
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
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const rawUrl = String(req.originalUrl || req.url || '');
      const safeUrl = rawUrl.split('?')[0];
      const baseLine = `${req.method} ${safeUrl} ${res.statusCode} ${duration}ms`;
      if (res.statusCode >= 500) {
        logger.error(`[OPS_HTTP] ${baseLine}`);
      } else if (res.statusCode >= 400) {
        logger.warn(`[OPS_HTTP] ${baseLine}`);
      } else {
        logger.log(baseLine);
      }

      if (
        safeUrl === '/auth/login' ||
        safeUrl === '/v2/import/sync' ||
        safeUrl === '/v2/import/manual-year' ||
        safeUrl === '/v2/forecast/scenarios'
      ) {
        logger.log(
          `[OPS_FUNNEL] ${req.method} ${safeUrl} ${res.statusCode} ${duration}ms`,
        );
      }
    });
    next();
  });

  // Track rejected origins to avoid log spam
  const rejectedOrigins = new Set<string>();

  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'Accept',
    'x-demo-key',
  ];

  if (isProd) {
    logger.log(
      `CORS allowed origins: ${preflightOrigins.join(', ') || '(none)'}`,
    );
  } else {
    logger.log(`CORS dev origins: ${devOrigins.join(', ')}`);
    if (isDemo) {
      logger.log(
        'CORS demo mode: accepting ALL origins (safe — non-production only)',
      );
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
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
