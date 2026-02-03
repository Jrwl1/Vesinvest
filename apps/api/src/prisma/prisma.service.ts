import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _isDbReady = false;

  get isDbReady(): boolean {
    return this._isDbReady;
  }

  onModuleInit() {
    // Non-blocking: start connection in background
    this.connectWithRetry();
  }

  private async connectWithRetry(retries = 5, delay = 2000): Promise<void> {
    this.logger.log('DB connect started...');
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        this._isDbReady = true;
        this.logger.log('DB connected');
        return;
      } catch (error) {
        this.logger.warn(`DB connect attempt ${attempt}/${retries} failed: ${error.message}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    this.logger.error('DB connect failed after all retries. Will retry on first query.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}