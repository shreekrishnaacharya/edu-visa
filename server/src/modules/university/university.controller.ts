import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UniversityService } from './university.service';
import { PageDto } from '../../common/dto/page.dto';
import { UniversitySearchDto } from './dto/university-search.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';
import { University } from './university.entity';

@Controller('universities')
export class UniversityController {
  constructor(private readonly universities: UniversityService) {}

  @Get()
  list(@Query() page: PageDto, @Query() search: UniversitySearchDto) {
    return this.universities.list(page, search);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    // Campuses come with the record: a provider is routinely one institution in
    // several cities, and the detail page has to show all of them.
    return this.universities.getOne(id, { campuses: true });
  }

  @Roles(Role.SuperAdmin)
  @Post()
  create(@Body() dto: Partial<University>) {
    return this.universities.create(dto);
  }

  @Roles(Role.SuperAdmin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<University>) {
    return this.universities.update(id, dto);
  }

  @Roles(Role.SuperAdmin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.universities.remove(id);
  }
}
