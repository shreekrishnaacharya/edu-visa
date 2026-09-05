import type { AccessControlProvider } from "@refinedev/core";
import { getDemoUser } from "./authProvider";

// The NestJS API is the real authority on RBAC + branch tenancy (PRODUCT_PLAN
// §8). This only mirrors the coarse rules so the UI hides actions the server
// would reject anyway: catalogue writes are super_admin-only; visa-history
// needs the `visa:read` grant (carried on the super_admin seed).
const CATALOGUE = new Set(["courses", "universities"]);
const WRITE = new Set(["create", "edit", "delete"]);

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const role = getDemoUser().role;
    if (role === "super_admin") return { can: true };
    if (resource && CATALOGUE.has(resource) && action && WRITE.has(action)) {
      return { can: false, reason: "Catalogue changes are super-admin only." };
    }
    return { can: true };
  },
  options: { buttons: { enableAccessControl: true, hideIfUnauthorized: false } },
};
