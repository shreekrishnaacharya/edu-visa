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
}
