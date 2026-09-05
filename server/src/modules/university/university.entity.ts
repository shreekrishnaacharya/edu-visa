import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Country } from '../../common/enums';
import { Course } from '../course/course.entity';

@Entity('university')
export class University {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 2 })
  country: Country;

  @Column()
  city: string;

  @Column({ type: 'int', default: 999 })
  world_rank: number;

  /** 0-360, drives a generated monogram on the frontend. */
  @Column({ type: 'int', default: 210 })
  logo_hue: number;

  /** Set when a re-verification pass last confirmed this row (PRODUCT_PLAN §2). */
  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  @OneToMany(() => Course, (c) => c.university)
  courses: Course[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
