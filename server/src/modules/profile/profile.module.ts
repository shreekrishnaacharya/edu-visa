import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './student-profile.entity';
import { ProfileService } from './profile.service';
import { ReferenceModule } from '../reference/reference.module';

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile]), ReferenceModule],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
