import type { StudentDocument } from "../types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// A minimal one-page PDF — stands in for a real upload in the seed data.
// Non-image type, so the UI shows a file icon rather than a broken thumbnail.
const STUB_PDF =
  "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAyMDAgMjAwXT4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1NCAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTc4CiUlRU9G";

export const DOC_TYPE_PRESETS = [
  "Academic transcript",
  "Degree certificate",
  "Passport",
  "English test report",
  "Bank statement",
  "Financial document",
  "Loan sanction letter",
  "Sponsor document",
  "Statement of Purpose",
  "Work experience letter",
];

export const documents: StudentDocument[] = [
  {
    id: "d-seed-1",
    student_id: "s-001",
    doc_type: "Loan sanction letter",
    remark: "Education loan NPR 5,000,000 sanctioned by Nabil Bank. Covers 2 years of tuition + living.",
    file: { id: "att-d1", name: "loan-sanction.pdf", type: "application/pdf", size: 84213, data_url: STUB_PDF },
    uploaded_by: "Bina Rai",
    created_at: daysAgo(4),
  },
  {
    id: "d-seed-2",
    student_id: "s-001",
    doc_type: "English test report",
    remark: "PTE Academic — overall 67, no band below 58.",
    file: { id: "att-d2", name: "pte-scorecard.pdf", type: "application/pdf", size: 61220, data_url: STUB_PDF },
    uploaded_by: "Bina Rai",
    created_at: daysAgo(11),
  },
  {
    id: "d-seed-3",
    student_id: "s-004",
    doc_type: "Bank statement",
    remark: "6-month statement, father's account. Closing balance NPR 4.1M.",
    file: { id: "att-d3", name: "bank-statement-6mo.pdf", type: "application/pdf", size: 132880, data_url: STUB_PDF },
    uploaded_by: "Suman K.C.",
    created_at: daysAgo(7),
  },
];
