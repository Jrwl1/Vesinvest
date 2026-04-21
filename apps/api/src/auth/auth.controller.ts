import {
  Body,
  Controller,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AppModeService } from '../app-mode/app-mode.service';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { LoginDto } from './dto/login.dto';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from './jwt.guard';
import {
  AUTH_EDGE_RATE_LIMIT_HEADER,
  resolveAuthRateLimitMode,
} from './rate-limit-contract';

// Simple in-memory rate limiter for demo-login
const demoRateLimit = new Map<string, { count: number; resetAt: number }>();
const DEMO_RATE_LIMIT_MAX = 30;
const DEMO_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Basic in-memory protection for auth endpoints.
// For multi-instance production, replace with a shared store-backed limiter.
const loginRateLimit = new Map<string, { count: number; resetAt: number }>();
const failedLoginRateLimit = new Map<
  string,
  { count: number; resetAt: number }
>();
const inviteAcceptRateLimit = new Map<
  string,
  { count: number; resetAt: number }
>();
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOGIN_RATE_LIMIT_MAX = 25;
const LOGIN_FAILED_RATE_LIMIT_MAX = 5;
const INVITE_ACCEPT_RATE_LIMIT_MAX = 20;
const authValidationPipeOptions = {
  transform: true,
  whitelist: true,
} as const;
type AuthRequestUser = {
  sub?: string;
  org_id?: string;
  roles?: string[];
};

function getRequestIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function readHeaderValue(req: Request, headerName: string): string | null {
  const raw = req.headers[headerName];
  if (Array.isArray(raw)) {
    return raw[0]?.trim() || null;
  }
  return typeof raw === 'string' ? raw.trim() || null : null;
}

function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isFailedLoginBlocked(key: string): boolean {
  const now = Date.now();
  const record = failedLoginRateLimit.get(key);
  if (!record || now > record.resetAt) {
    failedLoginRateLimit.delete(key);
    return false;
  }
  return record.count >= LOGIN_FAILED_RATE_LIMIT_MAX;
}

function recordFailedLoginAttempt(key: string): number {
  const now = Date.now();
  const record = failedLoginRateLimit.get(key);

  if (!record || now > record.resetAt) {
    failedLoginRateLimit.set(key, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return 1;
  }

  record.count += 1;
  return record.count;
}

function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
): boolean {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= max) return false;

  record.count += 1;
  return true;
}

function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = demoRateLimit.get(ip);

  if (!record || now > record.resetAt) {
    demoRateLimit.set(ip, {
      count: 1,
      resetAt: now + DEMO_RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (record.count >= DEMO_RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly invitationsService: InvitationsService,
    private readonly appModeService: AppModeService,
  ) {}

  @Post('login')
  async login(
    @Req() req: Request,
    @Body(new ValidationPipe(authValidationPipeOptions)) dto: LoginDto,
  ) {
    const rateLimitMode = resolveAuthRateLimitMode();
    this.assertEdgeRateLimitVerified(req, rateLimitMode, 'auth-login');
    const ip = getRequestIp(req);
    const failureKey = `${ip}:${normalizeLoginEmail(dto.email)}`;
    if (
      rateLimitMode === 'memory' &&
      !checkRateLimit(loginRateLimit, ip, LOGIN_RATE_LIMIT_MAX)
    ) {
      this.logger.warn(`auth-login rate-limited (ip=${ip})`);
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (rateLimitMode === 'memory' && isFailedLoginBlocked(failureKey)) {
      this.logger.warn(`auth-login blocked after repeated failures (ip=${ip})`);
      throw new HttpException(
        'Too many failed login attempts. Please wait and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const result = await this.authService.login(
        dto.email,
        dto.password,
        dto.orgId,
      );
      if (rateLimitMode === 'memory') {
        failedLoginRateLimit.delete(failureKey);
      }
      this.logger.log(
        `auth-login success (ip=${ip}, org=${result.user?.orgId ?? 'unknown'})`,
      );
      return result;
    } catch (error) {
      if (
        rateLimitMode === 'memory' &&
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.UNAUTHORIZED
      ) {
        const failedAttempts = recordFailedLoginAttempt(failureKey);
        if (failedAttempts >= LOGIN_FAILED_RATE_LIMIT_MAX) {
          this.logger.warn(
            `auth-login blocked after repeated failures (ip=${ip})`,
          );
          throw new HttpException(
            'Too many failed login attempts. Please wait and try again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      const message =
        error instanceof Error ? error.message : 'unknown auth error';
      this.logger.warn(`auth-login failed (ip=${ip}, reason=${message})`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async me(@Req() req: Request) {
    return this.authService.me(req.user);
  }

  // DEV-ONLY: bypass login for local development (7-day token)
  // Requires DEV_AUTH_BYPASS=true and is never available in production.
  @Post('dev-token')
  async devToken() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    if (process.env.DEV_AUTH_BYPASS !== 'true') {
      throw new NotFoundException();
    }

    return this.authService.devToken();
  }

  // Demo login: bootstraps demo org/user/data and returns token
  // Requires demo mode enabled (on by default in dev unless DEMO_MODE=false)
  @Post('demo-login')
  async demoLogin(@Req() req: Request) {
    const rateLimitMode = resolveAuthRateLimitMode();
    this.assertEdgeRateLimitVerified(req, rateLimitMode, 'demo-login');
    const ip = getRequestIp(req);
    const demoEnabled = this.appModeService.isDemoLoginEnabled();

    // Guard 1: demo mode must be enabled
    if (!demoEnabled) {
      this.logger.warn(`demo-login rejected: demo mode disabled (ip=${ip})`);
      throw new NotFoundException();
    }

    // Guard 2: Rate limit
    if (rateLimitMode === 'memory' && !checkDemoRateLimit(ip)) {
      this.logger.warn(`demo-login rejected: rate limit exceeded (ip=${ip})`);
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.authService.demoLogin();
    this.logger.log('demo-login ok');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations')
  async createInvitation(
    @Req() req: Request,
    @Body(new ValidationPipe(authValidationPipeOptions)) dto: InviteUserDto,
  ) {
    const user = req.user as AuthRequestUser | undefined;
    if (!user?.sub || !user?.org_id) {
      throw new ForbiddenException('Missing user context');
    }
    return this.invitationsService.createInvitation(
      user.org_id,
      user.sub,
      user.roles ?? [],
      dto,
    );
  }

  @Post('invitations/accept')
  async acceptInvitation(
    @Req() req: Request,
    @Body(new ValidationPipe(authValidationPipeOptions)) dto: AcceptInvitationDto,
  ) {
    const rateLimitMode = resolveAuthRateLimitMode();
    this.assertEdgeRateLimitVerified(req, rateLimitMode, 'invite-accept');
    const ip = getRequestIp(req);
    if (
      rateLimitMode === 'memory' &&
      !checkRateLimit(inviteAcceptRateLimit, ip, INVITE_ACCEPT_RATE_LIMIT_MAX)
    ) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const principal = await this.invitationsService.acceptInvitation(dto);
    const issued = await this.authService.issueTokenForUser(
      principal.userId,
      principal.orgId,
      principal.roles,
    );
    const legal = await this.authService.me({
      sub: principal.userId,
      org_id: principal.orgId,
      roles: principal.roles,
    });
    return {
      ...issued,
      legal: legal.legal,
    };
  }

  private assertEdgeRateLimitVerified(
    req: Request,
    rateLimitMode: 'memory' | 'edge',
    action: 'auth-login' | 'demo-login' | 'invite-accept',
  ) {
    if (rateLimitMode !== 'edge') {
      return;
    }

    const expectedSecret = process.env.AUTH_EDGE_RATE_LIMIT_SECRET?.trim();
    const headerValue = readHeaderValue(req, AUTH_EDGE_RATE_LIMIT_HEADER);

    if (!expectedSecret) {
      this.logger.error(
        `${action} rejected: AUTH_EDGE_RATE_LIMIT_SECRET missing while AUTH_RATE_LIMIT_MODE=edge`,
      );
      throw new HttpException(
        'Auth rate-limit edge verification is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (headerValue !== expectedSecret) {
      this.logger.warn(
        `${action} rejected: trusted edge rate-limit verification missing`,
      );
      throw new HttpException(
        'Auth rate-limit edge verification missing.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
