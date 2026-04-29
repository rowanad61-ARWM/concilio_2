import {
  createClientProfileResourceRowRoutes,
  PROFESSIONAL_RELATIONSHIP_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceRowRoutes(PROFESSIONAL_RELATIONSHIP_CONFIG)

export const PATCH = routes.PATCH
export const DELETE = routes.DELETE
