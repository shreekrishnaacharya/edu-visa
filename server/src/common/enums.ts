// Domain enums — mirror src/mocks/types.ts on the frontend.

export type Country = 'AU' | 'NZ' | 'UK' | 'CA' | 'US';
export type DegreeLevel = 'Bachelor' | 'PG Diploma' | 'Master' | 'PhD';
export type AcademicLevel = DegreeLevel | 'High School';
export type EnglishTest = 'IELTS' | 'PTE' | 'TOEFL' | 'Duolingo';
export type GpaScale = '4.0' | '10.0' | 'percentage' | 'division';
export type Currency = 'NPR' | 'AUD' | 'GBP' | 'CAD' | 'USD';
export type PrIntent = 'low' | 'medium' | 'high';
export type StudentState = 'Enquiry' | 'Profiling' | 'Shortlisted' | 'Applied';
export type PassportStatus = 'none' | 'applied' | 'held';
export type LongTermGoal =
  | 'employment'
  | 'PR'
  | 'return home'
  | 'business'
  | 'further study';

export type MatchDimension =
  | 'academic'
  | 'english'
  | 'financial'
  | 'career'
  | 'location'
  | 'scholarship';

export type MatchWeights = Record<MatchDimension, number>;

export enum Role {
  Student = 'student',
  Counsellor = 'counsellor',
  BranchAdmin = 'branch_admin',
  SuperAdmin = 'super_admin',
}

export const CURRENCIES: Currency[] = ['NPR', 'AUD', 'GBP', 'CAD', 'USD'];
export const DEGREE_LEVELS: DegreeLevel[] = [
  'Bachelor',
  'PG Diploma',
  'Master',
  'PhD',
];
