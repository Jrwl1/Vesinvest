import {
  Body,
  Controller,
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
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';

// Simple in-memory rate limiter for demo-login
const demoRateLimit = new Map<string, { count: number; resetAt: number }>();
const DEMO_RATE_LIMIT_MAX = 30;
const DEMO_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = demoRateLimit.get(ip);

  if (!record || now > record.resetAt) {
    demoRateLimit.set(ip, { count: 1, resetAt: now + DEMO_RATE_LIMIT_WINDOW_MS });
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

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password, dto.orgId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async me(@Req() req: any) {
    return this.authService.me(req.user);
  }

  // DEV-ONLY: bypass login for local development (7-day token)
  // Enable via DEV_AUTH_BYPASS=true or when NODE_ENV is not 'production'
  @Post('dev-token')
  async devToken() {
    const isProd = process.env.NODE_ENV === 'production';
    const bypassEnabled = process.env.DEV_AUTH_BYPASS === 'true';

    // Allow in non-production OR when explicitly enabled via env flag
    if (isProd && !bypassEnabled) {
      throw new NotFoundException();
    }

    return this.authService.devToken();
  }

  // Demo login: bootstraps demo org/user/data and returns token
  // Requires: DEMO_MODE=true AND DEMO_KEY set AND x-demo-key header matching
  @Post('demo-login')
  async demoLogin(@Req() req: Request, @Headers('x-demo-key') demoKey?: string) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const demoEnabled = process.env.DEMO_MODE === 'true';
    const expectedKey = process.env.DEMO_KEY;

    // Guard 1: DEMO_MODE must be true
    if (!demoEnabled) {
      this.logger.warn(`demo-login rejected: DEMO_MODE disabled (ip=${ip})`);
      throw new NotFoundException();
    }

    // Guard 2: DEMO_KEY must be set in env
    if (!expectedKey) {
      this.logger.warn(`demo-login rejected: DEMO_KEY not configured (ip=${ip})`);
      throw new NotFoundException();
    }

    // Guard 3: x-demo-key header must match
    if (demoKey !== expectedKey) {
      this.logger.warn(`demo-login rejected: invalid key (ip=${ip})`);
      throw new NotFoundException();
    }

    // Guard 4: Rate limit
    if (!checkDemoRateLimit(ip)) {
      this.logger.warn(`demo-login rejected: rate limit exceeded (ip=${ip})`);
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    const result = await this.authService.demoLogin();
    this.logger.log('demo-login ok');
    return result;
  }
}