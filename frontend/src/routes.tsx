import { Navigate, type RouteObject } from "react-router";
import { Authenticated } from "@refinedev/core";
import { MainLayout } from "./layout/MainLayout";

import { StudentListPage } from "@student/list/list";
import { StudentIntakePage } from "@student/intake/intake";
import { StudentShowPage } from "@student/show/show";
import { MatchResultPage } from "@match/result";
import { CatalogueListPage } from "@catalog/list";
import { CourseFormPage } from "@catalog/course-form";
import { CourseImportPage } from "@catalog/import";
import { UniversityListPage } from "@university/list";
import { UniversityFormPage } from "@university/university-form";
import { UniversityShowPage } from "@university/show";
import { LoginPage } from "./modules/@auth/login";

const shell = (node: React.ReactNode) => (
  <Authenticated key="app-auth" fallback={<Navigate to="/login" replace />}>
    <MainLayout>{node}</MainLayout>
  </Authenticated>
);

export const routes: RouteObject[] = [
  { path: "/", element: <Navigate to="/students" replace /> },
  { path: "/login", element: <LoginPage /> },

  { path: "/students", element: shell(<StudentListPage />) },
  { path: "/students/new", element: shell(<StudentIntakePage mode="create" />) },
  { path: "/students/:id", element: shell(<StudentShowPage />) },
  { path: "/students/:id/edit", element: shell(<StudentIntakePage mode="edit" />) },
  { path: "/students/:id/matches", element: shell(<MatchResultPage />) },

  { path: "/catalogue", element: shell(<CatalogueListPage />) },
  { path: "/catalogue/new", element: shell(<CourseFormPage mode="create" />) },
  { path: "/catalogue/import", element: shell(<CourseImportPage />) },
  { path: "/catalogue/:id/edit", element: shell(<CourseFormPage mode="edit" />) },

  { path: "/universities", element: shell(<UniversityListPage />) },
  { path: "/universities/new", element: shell(<UniversityFormPage mode="create" />) },
  { path: "/universities/:id", element: shell(<UniversityShowPage />) },
  { path: "/universities/:id/edit", element: shell(<UniversityFormPage mode="edit" />) },

  { path: "*", element: shell(<Navigate to="/students" replace />) },
];
