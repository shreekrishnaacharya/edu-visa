// ---------------------------------------------------------------------------
// Mutable in-memory store. Seeded once per page load from the fixtures; the
// mock transport (mock-axios) reads and writes this so intake edits and match
// runs persist for the session.
// ---------------------------------------------------------------------------

import type { Course, FollowUp, MatchRun, Student, StudentDocument, University } from "../types";
import { courses as courseSeed } from "./courses";
import { students as studentSeed } from "./students";
import { universities as uniSeed } from "./universities";
import { followUps as followUpSeed } from "./follow-ups";
import { documents as documentSeed } from "./documents";

export interface Db {
  students: Student[];
  universities: University[];
  courses: Course[];
  "match-runs": MatchRun[];
  "follow-ups": FollowUp[];
  documents: StudentDocument[];
}

// structuredClone keeps the seed arrays pristine if the store is ever reset.
export const db: Db = {
  students: structuredClone(studentSeed),
  universities: structuredClone(uniSeed),
  courses: structuredClone(courseSeed),
  "match-runs": [],
  "follow-ups": structuredClone(followUpSeed),
  documents: structuredClone(documentSeed),
};

export type Resource = keyof Db;

const ID_PREFIX: Partial<Record<Resource, string>> = {
  "match-runs": "mr",
  "follow-ups": "f",
  documents: "d",
};

export function nextId(resource: Resource): string {
  const n = db[resource].length + 1;
  return `${ID_PREFIX[resource] ?? resource[0]}-${Date.now().toString(36)}-${n}`;
}
