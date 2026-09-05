import { Body, Controller, Post, Query } from '@nestjs/common';
import { CourseImportService } from './course-import.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';

@Roles(Role.SuperAdmin)
@Controller('courses/import')
export class CourseImportController {
  constructor(private readonly importer: CourseImportService) {}

  @Post()
  import(@Body('csv') csv: string, @Query('dryRun') dryRun?: string) {
    return this.importer.importCsv(csv, dryRun !== 'false');
  }
}
