import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { AdmissionPolicy } from './admission-policy.types';

export type PolicyReviewStatus = 'ai_drafted' | 'reviewed';

/**
 * DB-backed home for real, per-institution admission-eligibility rules —
 * replaces the original static `admission-policy.data.ts` array (kept now
 * only as that array's one-time seed source, see
 * server/scripts/seed-admission-policies.mjs). Moved here specifically so
 * the university-document upload pipeline can WRITE a new institution's
 * rules, not just read the 9 originally hand-typed ones.
 *
 * `data` holds the whole `AdmissionPolicy` object as one JSONB blob — same
 * "cohesive structure, not worth normalising into a dozen child tables"
 * choice already made for `Course.entry`/`MatchRun.results` elsewhere in
 * this codebase; `AdmissionEligibilityService` always reads the whole thing
 * at once regardless of storage shape.
 */
@Entity('admission_policy')
export class AdmissionPolicyEntity {
  @PrimaryColumn()
  key: string;

  @Column()
  @Index()
  institution: string;

  @Column({ type: 'jsonb' })
  data: AdmissionPolicy;

  /** The university_document upload that drafted this, if any — null for the 9 originally hand-typed policies. */
  @Column({ type: 'uuid', nullable: true })
  source_document_id: string | null;

  /**
   * 'ai_drafted' = populated by the upload pipeline's structuring pass, not
   * yet looked at by a human — still LIVE and used by the real checker
   * immediately (never gated on review, per explicit product direction);
   * this is purely an honesty marker. 'reviewed' = the 9 originally
   * hand-typed policies, or anything an admin has since edited/confirmed via
   * PATCH /admission/institutions/:key.
   */
  @Column({ type: 'varchar', default: 'ai_drafted' })
  review_status: PolicyReviewStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
