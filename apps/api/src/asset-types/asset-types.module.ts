import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetTypesController } from './asset-types.controller';
import { AssetTypesService } from './asset-types.service';
import { AssetTypesRepository } from './asset-types.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AssetTypesController],
  providers: [AssetTypesService, AssetTypesRepository],
})
export class AssetTypesModule {}