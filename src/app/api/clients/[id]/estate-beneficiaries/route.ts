import {
  createClientProfileResourceCollectionRoutes,
  ESTATE_BENEFICIARY_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceCollectionRoutes(ESTATE_BENEFICIARY_CONFIG)

export const GET = routes.GET
export const POST = routes.POST
