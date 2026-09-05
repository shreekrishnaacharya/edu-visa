import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Currency } from '../../common/enums';
import { numericTransformer } from '../../common/database/numeric.transformer';

/**
 * DB-backed FX table (PRODUCT_PLAN §2 "normalization tables") — the one of the
 * three reference tables most likely to need an admin update between deploys.
 * GPA-scale and English-test concordance stay as versioned pure functions in
 * match/engine/reference.ts (ported verbatim from the prototype); promoting
 * them to tables too is straightforward follow-up once the importer exists.
 */
@Entity('fx_rate')
export class FxRate {
  @PrimaryColumn({ type: 'varchar', length: 3 })
  currency: Currency;

  /** Rate to convert 1 unit of `currency` into AUD (the comparison currency). */
  @Column({ type: 'numeric', transformer: numericTransformer })
  to_aud: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
