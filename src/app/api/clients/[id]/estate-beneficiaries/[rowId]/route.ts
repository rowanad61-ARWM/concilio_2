import {
  createClientProfileResourceRowRoutes,
  ESTATE_BENEFICIARY_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceRowRoutes(ESTATE_BENEFICIARY_CONFIG)

export const PATCH = routes.PATCH
export const DELETE = routes.DELETE
