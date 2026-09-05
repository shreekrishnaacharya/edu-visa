import type { ResourceProps } from "@refinedev/core";

export const resources: ResourceProps[] = [
  {
    name: "students",
    list: "/students",
    create: "/students/new",
    edit: "/students/:id/edit",
    show: "/students/:id",
    meta: { label: "Students" },
  },
  {
    name: "courses",
    list: "/catalogue",
    meta: { label: "Course catalogue" },
  },
  {
    name: "universities",
    meta: { label: "Universities" },
  },
  {
    name: "match-runs",
    meta: { label: "Match history", hide: true },
  },
  {
    name: "follow-ups",
    meta: { label: "Follow-ups", hide: true },
  },
  {
    name: "documents",
    meta: { label: "Documents", hide: true },
  },
];
