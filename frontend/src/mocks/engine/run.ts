// ---------------------------------------------------------------------------
// runMatch(studentId, weights) → MatchRun
// Knockout-filter the catalogue, score the survivors, rank, keep the top N,
// attach lightweight alternatives, and persist the run.
// ---------------------------------------------------------------------------

import type { MatchRun, MatchWeights } from "../types";
import { db, nextId } from "../db";
import { DEFAULT_WEIGHTS, ENGINE_VERSION } from "./weights";
import { deriveProfile } from "./derive";
import { score } from "./score";

export interface RunOptions {
  weights?: MatchWeights;
  limit?: number;
  createdBy?: string;
  /** false → compute only, don't push into the in-memory match-runs store */
  persist?: boolean;
}

export function runMatch(studentId: string, opts: RunOptions = {}): MatchRun {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) throw new Error(`student ${studentId} not found`);

  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const limit = opts.limit ?? 8;

  const prevVersions = db["match-runs"].filter((r) => r.student_id === studentId).length;
  const profile = deriveProfile(student, prevVersions + 1);

  const uniById = new Map(db.universities.map((u) => [u.id, u]));

  const scored = db.courses
    .map((course) => {
      const uni = uniById.get(course.university_id)!;
      return score(profile, student, course, uni, weights);
    })
    .filter((r) => !r.knockout)
    .sort((a, b) => b.overall - a.overall);

  const top = scored.slice(0, limit);

  // "alternatives": next-best course in the same field for each recommendation
  for (const r of top) {
    const mineField = db.courses.find((c) => c.id === r.course_id)?.field;
    const alt = scored.find(
      (o) => o.course_id !== r.course_id && db.courses.find((c) => c.id === o.course_id)?.field === mineField,
    );
    if (alt) {
      const altCourse = db.courses.find((c) => c.id === alt.course_id)!;
      const altUni = uniById.get(altCourse.university_id)!;
      r.alternatives = [`${altCourse.title} at ${altUni.name} (${alt.overall}% match)`];
    }
  }

  const run: MatchRun = {
    id: nextId("match-runs"),
    student_id: studentId,
    profile_version: profile.version,
    engine_version: ENGINE_VERSION,
    weights,
    created_at: new Date().toISOString(),
    created_by: opts.createdBy ?? student.counsellor,
    results: top,
    profile,
  };

  if (opts.persist !== false) db["match-runs"].unshift(run);
  return run;
}
