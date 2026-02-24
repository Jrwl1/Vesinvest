import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AppModeService } from '../app-mode/app-mode.service';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { InvitationsService } from './invitations.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';

// Simple in-memory rate limiter for demo-login
const demoRateLimit = new Map<string, { count: number; resetAt: number }>();
const DEMO_RATE_LIMIT_MAX = 30;
const DEMO_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Basic in-memory protection for auth endpoints.
// For multi-instance production, replace with a shared store-backed limiter.
const loginRateLimit = new Map<string, { count: number; resetAt: number }>();
const inviteAcceptRateLimit = new Map<
  string,
  { count: number; resetAt: number }
>();
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOGIN_RATE_LIMIT_MAX = 25;
const INVITE_ACCEPT_RATE_LIMIT_MAX = 20;

function getRequestIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
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
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip = getRequestIp(req);
    if (!checkRateLimit(loginRateLimit, ip, LOGIN_RATE_LIMIT_MAX)) {
      this.logger.warn(`auth-login rate-limited (ip=${ip})`);
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const result = await this.authService.login(
        dto.email,
        dto.password,
        dto.orgId,
      );
      this.logger.log(
        `auth-login success (ip=${ip}, org=${result.user?.orgId ?? 'unknown'})`,
      );
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown auth error';
      this.logger.warn(`auth-login failed (ip=${ip}, reason=${message})`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async me(@Req() req: any) {
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
  async demoLogin(
    @Req() req: Request,
    @Headers('x-demo-key') demoKey?: string,
  ) {
    const ip = getRequestIp(req);
    const demoEnabled = this.appModeService.isDemoLoginEnabled();
    const expectedKey = process.env.DEMO_KEY;

    // Guard 1: demo mode must be enabled
    if (!demoEnabled) {
      this.logger.warn(`demo-login rejected: demo mode disabled (ip=${ip})`);
      throw new NotFoundException();
    }

    // Guard 2 & 3: When DEMO_KEY is set, require x-demo-key header to match.
    // When DEMO_KEY is not set (e.g. localhost), allow demo-login without header for "always works" flow.
    if (expectedKey && demoKey !== expectedKey) {
      this.logger.warn(`demo-login rejected: invalid key (ip=${ip})`);
      throw new NotFoundException();
    }

    // Guard 4: Rate limit
    if (!checkDemoRateLimit(ip)) {
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
  async createInvitation(@Req() req: any, @Body() dto: InviteUserDto) {
    const user = req.user;
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
    @Body() dto: AcceptInvitationDto,
  ) {
    const ip = getRequestIp(req);
    if (
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
}
