import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { useAuthStore } from '@/store/authStore'

// ── Pages ─────────────────────────────────────────────────────────────────────
import { LoginPage }       from '@/pages/auth/LoginPage'
import { SitesPage }       from '@/pages/sites/SitesPage'
import { SiteDetailPage }  from '@/pages/sites/SiteDetailPage'
import { CameraPage }      from '@/pages/camera/CameraPage'
import { InventoryPage }   from '@/pages/inventory/InventoryPage'
import { ItemDetailPage }  from '@/pages/inventory/ItemDetailPage'
import { MapPage }         from '@/pages/map/MapPage'
import { SettingsPage }    from '@/pages/settings/SettingsPage'

// ── Auth guard helper ─────────────────────────────────────────────────────────
function requireAuth() {
  const isAuth = useAuthStore.getState().isAuthenticated()
  if (!isAuth) throw redirect({ to: '/login' })
}

// ── Routes ────────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/sites' }) },
  component: () => null,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const sitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites',
  beforeLoad: requireAuth,
  component: SitesPage,
})

const siteDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites/$siteId',
  beforeLoad: requireAuth,
  component: SiteDetailPage,
})

const cameraRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites/$siteId/camera',
  beforeLoad: requireAuth,
  component: CameraPage,
})

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites/$siteId/review',
  beforeLoad: requireAuth,
  component: ReviewPage,
})

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites/$siteId/inventory',
  beforeLoad: requireAuth,
  component: InventoryPage,
})

const itemDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites/$siteId/inventory/$itemId',
  beforeLoad: requireAuth,
  component: ItemDetailPage,
})

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sites/$siteId/map',
  beforeLoad: requireAuth,
  component: MapPage,
})

// ── Route tree ────────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  sitesRoute,
  siteDetailRoute,
  cameraRoute,
  reviewRoute,
  inventoryRoute,
  itemDetailRoute,
  mapRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
