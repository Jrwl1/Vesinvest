import { Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TrialService } from './trial.service';

@UseGuards(JwtAuthGuard)
@Controller('trial')
export class TrialController {
  constructor(private readonly trialService: TrialService) {}

  @Get('status')
  async status(@Req() req: Request) {
    const user = req.user as any;
    if (!user?.org_id) throw new UnauthorizedException('Missing org context');
    return this.trialService.getStatus(user.org_id);
  }

  @Post('reset-data')
  async resetData(@Req() req: Request) {
    const user = req.user as any;
    if (!user?.org_id) throw new UnauthorizedException('Missing org context');
    return this.trialService.resetData(user.org_id, user.roles ?? []);
  }
}

