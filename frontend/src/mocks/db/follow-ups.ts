import type { FollowUp } from "../types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const followUps: FollowUp[] = [
  {
    id: "f-seed-1",
    student_id: "s-001",
    kind: "call",
    body: "Called to discuss the Business Analytics shortlist. Aarati is keen on Sydney; asked her to confirm the PTE booking date and whether the education loan is sanctioned.",
    author: "Bina Rai",
    created_at: daysAgo(12),
    attachments: [],
  },
  {
    id: "f-seed-2",
    student_id: "s-001",
    kind: "note",
    body: "Loan sanction letter received (NPR 5,000,000). Financials now look comfortable for the Master. Moving her to Shortlisted.",
    author: "Bina Rai",
    created_at: daysAgo(4),
    attachments: [],
  },
  {
    id: "f-seed-3",
    student_id: "s-004",
    kind: "meeting",
    body: "In-person with Deepak and spouse. Walked through the UK refusal from 2019 — advised a detailed cover letter addressing maintenance funds. Spouse will apply as a dependant.",
    author: "Suman K.C.",
    created_at: daysAgo(9),
    attachments: [],
  },
];
