import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { University } from './university.entity';

/**
 * One registered teaching location of an institution, from the CRICOS register's
 * locations file.
 *
 * Exists because a provider is routinely one institution in many cities — CQU
 * has 14 registered locations (Rockhampton, Brisbane, Melbourne, Sydney, Cairns,
 * Townsville, …). The catalogue previously kept a single `university.city` taken
 * from whichever location happened to come first in the file, so 13 of CQU's 14
 * campuses were discarded and its stored city was arbitrary. That also made the
 * matcher wrong rather than merely incomplete: `locationScore` compares `city`
 * literally against a student's preferred cities, so a student asking for
 * Melbourne never matched CQU even though CQU teaches there.
 */
@Entity('university_campus')
@Unique('UQ_university_campus_row', ['university_id', 'location_name', 'postcode'])
@Index(['university_id'])
@Index(['city'])
export class UniversityCampus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  university_id: string;

  @ManyToOne(() => University, (u) => u.campuses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'university_id' })
  university: University;

  /** As the register names it, e.g. "Rockhampton C.Q.U. Campus". */
  @Column({ type: 'varchar' })
  location_name: string;

  /** Metro label, derived the same way as `university.city` so the two compare. */
  @Column({ type: 'varchar' })
  city: string;

  /** The locality exactly as the register states it ("NORMAN GARDENS"). */
  @Column({ type: 'varchar', nullable: true })
  locality: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  postcode: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  /**
   * True for the campus whose postcode matches the institution's registered
   * postal address — the only non-arbitrary "main campus" signal the register
   * offers, and it resolves 513 of 663 providers. `university.city` is taken
   * from this one.
   */
  @Column({ type: 'boolean', default: false })
  is_primary: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
