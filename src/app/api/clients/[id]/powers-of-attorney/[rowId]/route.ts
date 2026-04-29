import {
  createClientProfileResourceRowRoutes,
  POWER_OF_ATTORNEY_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceRowRoutes(POWER_OF_ATTORNEY_CONFIG)

export const PATCH = routes.PATCH
export const DELETE = routes.DELETE
