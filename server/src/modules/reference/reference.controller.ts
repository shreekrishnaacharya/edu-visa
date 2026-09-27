import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ReferenceService } from './reference.service';

@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Public()
  @Get('fx-rates')
  fxRates() {
    return this.reference.fxTable();
  }

  /**
   * Cities where courses are actually taught, for the catalogue's "taught in"
   * filter. Drawn from the register's campus list, so it only ever offers places
   * that really have a campus.
   */
  @Get('campus-cities')
  campusCities() {
    return this.reference.campusCities();
  }
}
