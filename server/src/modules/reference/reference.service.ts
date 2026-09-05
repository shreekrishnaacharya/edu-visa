import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency, EnglishTest, GpaScale } from '../../common/enums';
import { FxRate } from './fx-rate.entity';
import {
  FX_TO_AUD,
  toCanonicalGpa,
  toIeltsEquivalent,
} from '../match/engine/reference';

@Injectable()
export class ReferenceService implements OnModuleInit {
  private rates: Record<Currency, number> = { ...FX_TO_AUD };

  constructor(@InjectRepository(FxRate) private readonly fxRepo: Repository<FxRate>) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload(): Promise<void> {
    const rows = await this.fxRepo.find();
    if (rows.length) {
      for (const r of rows) this.rates[r.currency] = r.to_aud;
    }
  }

  toAud(amount: number, currency: Currency): number {
    return Math.round(amount * this.rates[currency]);
  }

  fxTable(): Record<Currency, number> {
    return { ...this.rates };
  }

  toCanonicalGpa(value: number, scale: GpaScale): number {
    return toCanonicalGpa(value, scale);
  }

  toIeltsEquivalent(test: EnglishTest, overall: number): number {
    return toIeltsEquivalent(test, overall);
  }
}
