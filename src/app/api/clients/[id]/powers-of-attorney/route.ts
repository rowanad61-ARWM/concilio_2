import {
  createClientProfileResourceCollectionRoutes,
  POWER_OF_ATTORNEY_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceCollectionRoutes(POWER_OF_ATTORNEY_CONFIG)

export const GET = routes.GET
export const POST = routes.POST
