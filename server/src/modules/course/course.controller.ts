import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { PageDto } from '../../common/dto/page.dto';
import { CourseSearchDto } from './dto/course-search.dto';
import { CourseWriteDto } from './dto/course-write.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';

@Controller('courses')
export class CourseController {
  constructor(private readonly courses: CourseService) {}

  @Get()
  list(@Query() page: PageDto, @Query() search: CourseSearchDto) {
    return this.courses.list(page, search);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.courses.getOneWithRelations(id);
  }

  @Roles(Role.SuperAdmin)
  @Post()
  create(@Body() dto: CourseWriteDto) {
    return this.courses.createFromDto(dto);
  }

  @Roles(Role.SuperAdmin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CourseWriteDto>) {
    return this.courses.updateFromDto(id, dto);
  }

  @Roles(Role.SuperAdmin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courses.remove(id);
  }
}
