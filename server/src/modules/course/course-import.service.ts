import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { Course } from './course.entity';
import { University } from '../university/university.entity';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  imported: number;
  errors: ImportRowError[];
}

/**
 * CRICOS-style CSV importer (PRODUCT_PLAN §5 "Side B sourcing").  Expected
 * columns: university_name,country,city,title,degree_level,field,
 * duration_months,tuition_fee,currency,next_intake_date,application_deadline,
 * min_gpa,min_english_band,cricos
 */
@Injectable()
export class CourseImportService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(University) private readonly universities: Repository<University>,
  ) {}

  async importCsv(csvText: string, dryRun: boolean): Promise<ImportResult> {
    const records: Record<string, string>[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const errors: ImportRowError[] = [];
    const toInsert: Partial<Course>[] = [];
    const uniByName = new Map(
      (await this.universities.find()).map((u) => [u.name.toLowerCase(), u]),
    );

    records.forEach((r, i) => {
      const rowNo = i + 2; // header is row 1
      const uni = uniByName.get((r.university_name ?? '').toLowerCase());
      if (!uni) {
        errors.push({ row: rowNo, message: `Unknown university "${r.university_name}"` });
        return;
      }
      if (uni.country === 'AU' && !r.cricos) {
        errors.push({ row: rowNo, message: 'cricos is required for AU courses' });
        return;
      }
      const tuition = Number(r.tuition_fee);
      const duration = Number(r.duration_months);
      if (!r.title || Number.isNaN(tuition) || Number.isNaN(duration)) {
        errors.push({ row: rowNo, message: 'Missing/invalid title, tuition_fee or duration_months' });
        return;
      }
      toInsert.push({
        university_id: uni.id,
        university_name: uni.name,
        country: uni.country,
        city: uni.city,
        world_rank: uni.world_rank,
        title: r.title,
        degree_level: r.degree_level as Course['degree_level'],
        field: r.field,
        duration_months: duration,
        tuition_fee: tuition,
        currency: (r.currency as Course['currency']) || 'AUD',
        intakes: (r.intakes ?? '').split('|').filter(Boolean),
        next_intake_date: r.next_intake_date,
        application_deadline: r.application_deadline,
        entry: {
          min_gpa: Number(r.min_gpa) || 0,
          min_english_band: Number(r.min_english_band) || 0,
          accepted_tests: ['IELTS', 'PTE', 'TOEFL'],
          prerequisites: (r.prerequisites ?? '').split('|').filter(Boolean),
          work_experience_months: Number(r.work_experience_months) || 0,
        },
        career_outcomes: (r.career_outcomes ?? '').split('|').filter(Boolean),
        cricos: r.cricos || null,
        verified_at: new Date(),
      });
    });

    if (!dryRun && toInsert.length) {
      await this.courses.save(toInsert as Course[]);
    }

    return {
      dry_run: dryRun,
      total_rows: records.length,
      valid_rows: toInsert.length,
      imported: dryRun ? 0 : toInsert.length,
      errors,
    };
  }
}
