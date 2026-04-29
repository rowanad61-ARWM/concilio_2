import {
  createClientProfileResourceCollectionRoutes,
  SUPER_PENSION_ACCOUNT_CONFIG,
} from "@/lib/client-profile-resource-routes"

const routes = createClientProfileResourceCollectionRoutes(SUPER_PENSION_ACCOUNT_CONFIG)

export const GET = routes.GET
export const POST = routes.POST
