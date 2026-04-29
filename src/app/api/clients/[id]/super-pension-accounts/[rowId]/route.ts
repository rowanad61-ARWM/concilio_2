import {
  createClientProfileResourceRowRoutes,
  SUPER_PENSION_ACCOUNT_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceRowRoutes(SUPER_PENSION_ACCOUNT_CONFIG)

export const PATCH = routes.PATCH
export const DELETE = routes.DELETE
