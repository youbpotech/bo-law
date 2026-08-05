import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { getAuthToken, isAuthenticated } from '../lib/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: {
        hideLayout: true,
        requiresGuest: true,
      },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        requiresAuth: true,
        requiredResource: 'dashboard',
      },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/UsersView.vue'),
      meta: {
        requiresAuth: true,
        requiredResource: 'users',
      },
    },
    {
      path: '/roles',
      name: 'roles',
      component: () => import('../views/RolesView.vue'),
      meta: { requiresAuth: true, requiredResource: 'roles', requiresRoleRoot: true },
    },
    {
      path: '/companies',
      name: 'companies',
      component: () => import('../views/CompaniesView.vue'),
      meta: {
        requiresAuth: true,
        requiresRoot: true,
        requiredResource: 'companies',
      },
    },
    {
      path: '/clients',
      name: 'clients',
      component: () => import('../views/ClientsView.vue'),
      meta: {
        requiresAuth: true,
        requiredResource: 'clients',
      },
    },
    { path: '/services', name: 'services', component: () => import('../views/ServicesView.vue'), meta: { requiresAuth: true, requiredResource: 'services' } },
    {
      path: '/leads',
      name: 'leads',
      component: () => import('../views/LeadsView.vue'),
      meta: {
        requiresAuth: true,
        requiredResource: 'leads',
      },
    },
    {
      path: '/cases',
      name: 'cases',
      component: () => import('../views/CasesView.vue'),
      meta: {
        requiresAuth: true,
        requiredResource: 'cases',
      },
    },
    {
      path: '/niss',
      name: 'niss',
      component: () => import('../views/NissView.vue'),
      meta: { requiresAuth: true, requiredResource: 'niss' },
    },
    {
      path: '/aima',
      name: 'aima',
      component: () => import('../views/AimaView.vue'),
      meta: { requiresAuth: true, requiredResource: 'aima' },
    },
  ],
})

async function hasRootAccess(): Promise<boolean> {
  const token = getAuthToken()

  if (!token) {
    return false
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return false
    }

    const user = (await response.json()) as { root?: boolean }
    return !!user.root
  } catch {
    return false
  }
}

async function getAccess(): Promise<{ root: boolean; roleRoot: boolean; permissions: string[] } | null> {
  const token = getAuthToken()
  if (!token) return null
  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    return response.ok ? ((await response.json()) as { root: boolean; roleRoot: boolean; permissions: string[] }) : null
  } catch { return null }
}

router.beforeEach(async (to) => {
  const hasValidAuthentication = isAuthenticated()

  if (to.meta.requiresAuth && !hasValidAuthentication) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresGuest && hasValidAuthentication) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
    return redirect
  }

  if (to.meta.requiresRoot && hasValidAuthentication) {
    const hasAccess = await hasRootAccess()

    if (!hasAccess) {
      return {
        name: 'home',
      }
    }
  }

  if ((to.meta.requiredResource || to.meta.requiresRoleRoot) && hasValidAuthentication) {
    const access = await getAccess()
    const resource = typeof to.meta.requiredResource === 'string' ? to.meta.requiredResource : null
    if (!access || (to.meta.requiresRoleRoot && !access.roleRoot) || (resource && !access.root && !access.permissions.includes(resource))) {
      const destinations: Record<string, string> = { dashboard: '/', users: '/users', roles: '/roles', clients: '/clients', companies: '/companies', services: '/services', leads: '/leads', cases: '/cases', niss: '/niss', aima: '/aima' }
      const first = access?.permissions.find((key) => destinations[key])
      return first ? destinations[first] : '/login'
    }
  }

  return true
})

export default router
