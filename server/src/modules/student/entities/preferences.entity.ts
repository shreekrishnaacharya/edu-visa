import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Country, Currency, DegreeLevel } from '../../../common/enums';
import { numericTransformer } from '../../../common/database/numeric.transformer';
import { Student } from './student.entity';

@Entity('preferences')
export class Preferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @OneToOne(() => Student, (s) => s.preferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'text', array: true, default: '{}' })
  preferred_countries: Country[];

  @Column({ type: 'text', array: true, default: '{}' })
  preferred_cities: string[];

  @Column({ type: 'varchar', default: 'Master' })
  degree_level: DegreeLevel;

  @Column({ default: '' })
  field: string;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  max_tuition_per_year: number;

  @Column({ type: 'varchar', length: 3, default: 'AUD' })
  tuition_currency: Currency;

  @Column({ default: '' })
  intake: string;

  @Column({ default: false })
  scholarship_required: boolean;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  min_scholarship_pct: number;

  @Column({ default: false })
  ranking_matters: boolean;

  @Column({ type: 'varchar', default: 'either' })
  city_size: 'big' | 'small' | 'either';

  @Column({ type: 'varchar', default: 'high' })
  cost_sensitivity: 'low' | 'high';

  @Column({ default: false })
  part_time_work_important: boolean;
}
