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
    create: "/catalogue/new",
    edit: "/catalogue/:id/edit",
    meta: { label: "Course catalogue" },
  },
  {
    name: "universities",
    list: "/universities",
    create: "/universities/new",
    edit: "/universities/:id/edit",
    show: "/universities/:id",
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
