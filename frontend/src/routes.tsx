import { Navigate, type RouteObject } from "react-router";
import { Authenticated } from "@refinedev/core";
import { MainLayout } from "./layout/MainLayout";

import { StudentListPage } from "@student/list/list";
import { StudentIntakePage } from "@student/intake/intake";
import { StudentShowPage } from "@student/show/show";
import { MatchResultPage } from "@match/result";
import { CatalogueListPage } from "@catalog/list";
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

  { path: "*", element: shell(<Navigate to="/students" replace />) },
];
