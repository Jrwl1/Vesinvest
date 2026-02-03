import { Body, Controller, Logger, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';

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
  // Enable via DEMO_MODE=true
  @Post('demo-login')
  async demoLogin() {
    const demoEnabled = process.env.DEMO_MODE === 'true';

    if (!demoEnabled) {
      this.logger.warn('Demo login attempted but DEMO_MODE is not enabled');
      throw new NotFoundException();
    }

    this.logger.log('Demo login requested');
    return this.authService.demoLogin();
  }
}