import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FxRate } from './fx-rate.entity';
import { ReferenceService } from './reference.service';
import { ReferenceController } from './reference.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FxRate])],
  providers: [ReferenceService],
  controllers: [ReferenceController],
  exports: [ReferenceService],
})
export class ReferenceModule {}
