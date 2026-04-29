import {
  createClientProfileResourceCollectionRoutes,
  PROFESSIONAL_RELATIONSHIP_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceCollectionRoutes(
  PROFESSIONAL_RELATIONSHIP_CONFIG,
)

export const GET = routes.GET
export const POST = routes.POST
