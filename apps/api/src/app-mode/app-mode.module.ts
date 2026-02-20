import { Global, Module } from '@nestjs/common';
import { AppModeService } from './app-mode.service';

@Global()
@Module({
  providers: [AppModeService],
  exports: [AppModeService],
})
export class AppModeModule {}

