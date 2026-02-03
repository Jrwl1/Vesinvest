import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness probe - no DB, just confirms Nest is up
  @Get('live')
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  // Readiness probe - checks DB connectivity
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      db: 'ok',
      time: new Date().toISOString(),
    };
  }
}