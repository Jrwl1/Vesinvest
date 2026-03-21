import { BadRequestException, Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LegalAcceptDto } from './dto/legal-accept.dto';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('current')
  async getCurrent() {
    return this.legalService.getCurrentDocuments();
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: Request) {
    const user = req.user as any;
    if (!user?.sub || !user?.org_id) throw new UnauthorizedException('Missing user context');
    return this.legalService.getUserStatus(user.org_id, user.sub, user.roles ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accept')
  async accept(@Req() req: Request, @Body() dto: LegalAcceptDto) {
    if (!dto.acceptTerms || !dto.acceptDpa) {
      throw new BadRequestException('Both Terms and DPA must be accepted');
    }
    const user = req.user as any;
    if (!user?.sub || !user?.org_id) throw new UnauthorizedException('Missing user context');
    const ip = req.ip ?? req.socket?.remoteAddress ?? undefined;
    const userAgent = req.headers['user-agent'] ?? undefined;
    const accepted = await this.legalService.acceptCurrent({
      orgId: user.org_id,
      userId: user.sub,
      ip,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    });
    const status = await this.legalService.getUserStatus(user.org_id, user.sub, user.roles ?? []);
    return { ...accepted, ...status };
  }
}
