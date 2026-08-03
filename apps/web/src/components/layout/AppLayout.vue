<template>
  <div class="flex h-screen bg-background">
    <!-- Sidebar -->
    <Sidebar
      :is-open="isSidebarOpen"
      :logo-url="currentUser?.company?.logoUrl"
      :company-name="currentUser?.company?.name"
      @close="fecharSidebar"
    >
      <nav class="space-y-2">
        <div v-for="item in navigationItems" :key="item.name">
          <!-- Menu item with submenu -->
          <div v-if="item.children" class="space-y-1">
            <button
              type="button"
              @click="toggleSubmenu(item.name)"
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div class="flex items-center space-x-3">
                <component :is="item.icon" class="h-4 w-4" />
                <span>{{ item.name }}</span>
              </div>
              <ChevronDown
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': openSubmenus[item.name] }"
              />
            </button>

            <!-- Submenu items -->
            <div v-if="openSubmenus[item.name]" class="ml-6 space-y-1">
              <router-link
                v-for="child in item.children"
                :key="child.name"
                :to="child.href"
                @click="fecharSidebar"
                class="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                :class="{
                  'bg-accent text-accent-foreground': $route.path === child.href,
                }"
              >
                <component :is="child.icon" class="h-4 w-4" />
                <span>{{ child.name }}</span>
              </router-link>
            </div>
          </div>

          <!-- Regular menu item without submenu -->
          <router-link
            v-else
            :to="item.href"
            @click="fecharSidebar"
            class="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="{
              'bg-accent text-accent-foreground': $route.path === item.href,
            }"
          >
            <component :is="item.icon" class="h-4 w-4" />
            <span>{{ item.name }}</span>
          </router-link>
        </div>
      </nav>
    </Sidebar>

    <!-- Main Content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <Header @toggle-sidebar="alternarSidebar">
        <template #breadcrumb>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" :aria-label="$t('navigation.dashboard')">
                <Home class="h-4 w-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator v-if="route.path !== '/'" />
            <BreadcrumbItem v-if="route.path !== '/'">
              <span class="text-foreground">{{ currentPageTitle }}</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </template>

        <template #actions>
          <div class="flex items-center space-x-2">
            <LanguageSelector v-if="false" />
            <ThemeToggle />
            <NotificationInbox />
            <DropdownMenu v-model="isProfileMenuOpen" align="end">
              <template #trigger="{ toggle }">
                <Button
                  variant="outline"
                  size="sm"
                  :aria-label="$t('profile.menu')"
                  @click="toggle"
                >
                  <User class="h-4 w-4" />
                </Button>
              </template>

              <template #default="{ close }">
                <div class="border-b px-2 py-2">
                  <p class="text-xs font-medium text-muted-foreground">Empresa atual</p>
                  <p class="truncate text-sm font-semibold">
                    {{ currentUser?.company?.name || 'Empresa não definida' }}
                  </p>
                </div>

                <div v-if="currentUser?.root" class="border-b py-1">
                  <p class="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Alternar empresa
                  </p>
                  <DropdownMenuItem
                    v-for="company in companies"
                    :key="company.id"
                    :disabled="isSwitchingCompany || company.id === currentUser.companyId"
                    @click="handleSwitchCompany(company.id, close)"
                  >
                    <span class="flex w-full items-center justify-between gap-3">
                      <span>{{ company.name }}</span>
                      <span
                        v-if="company.id === currentUser.companyId"
                        class="text-xs text-muted-foreground"
                      >
                        atual
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <p v-if="companiesError" class="px-2 py-1 text-xs text-destructive">
                    Não foi possível carregar empresas.
                  </p>
                </div>

                <DropdownMenuItem @click="handleLogout(close)">
                  {{ $t('profile.logout') }}
                </DropdownMenuItem>
              </template>
            </DropdownMenu>
          </div>
        </template>
      </Header>

      <!-- Page Content -->
      <main class="flex-1 overflow-auto p-6">
        <slot />
      </main>
      <footer class="border-t px-6 py-3 text-center text-xs text-muted-foreground">
        Copyright YouBPO - {{ currentYear }} - v. 0.1
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Home,
  Users,
  UsersRound,
  User,
  ChevronDown,
  UserCheck,
  Building2,
  ChartNoAxesColumn,
  DollarSign,
  Scale,
  ShieldCheck,
} from 'lucide-vue-next'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import Button from '@/components/ui/Button.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import NotificationInbox from '@/components/NotificationInbox.vue'
import LanguageSelector from '@/components/ui/LanguageSelector.vue'
import Breadcrumb from '@/components/ui/Breadcrumb.vue'
import BreadcrumbItem from '@/components/ui/BreadcrumbItem.vue'
import BreadcrumbLink from '@/components/ui/BreadcrumbLink.vue'
import BreadcrumbSeparator from '@/components/ui/BreadcrumbSeparator.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import { clearAuthToken } from '@/lib/auth'
import { queryClient } from '@/lib/query-client'
import { useCompanies, useSession, type ResourceKey } from '@/composables/useApi'
import { useTheme } from '@/composables/useTheme'
import { getSessionForUsername, rememberLastSession } from '@/lib/last-session'
import { setBrowserFavicon } from '@/lib/favicon'
import SocialSecurityIcon from '@/components/icons/SocialSecurityIcon.vue'
import AimaFaviconIcon from '@/components/icons/AimaFaviconIcon.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { theme, setTheme, setBrandThemeFromCompany } = useTheme()
const { currentUser, alternarEmpresa, isSwitchingCompany } = useSession()
const canLoadCompanies = computed(() => !!currentUser.value?.root)
const { companies, error: companiesError } = useCompanies(canLoadCompanies)

// State for sidebar visibility (mobile)
const isSidebarOpen = ref(false)

// State for open submenus
const openSubmenus = ref<Record<string, boolean>>({})
const isProfileMenuOpen = ref(false)
const currentYear = new Date().getFullYear()

// Funções para controlar a sidebar
const alternarSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const fecharSidebar = () => {
  // Só fecha em mobile (telas menores que lg)
  if (window.innerWidth < 1024) {
    isSidebarOpen.value = false
  }
}

const handleLogout = (close: () => void) => {
  clearAuthToken()
  queryClient.clear()
  setBrandThemeFromCompany('default')
  close()
  router.push('/login')
}

const handleSwitchCompany = async (companyId: number, close: () => void) => {
  const user = await alternarEmpresa(companyId)
  setBrandThemeFromCompany(user.company?.theme)
  close()
}

// Verificar tamanho da tela e ajustar sidebar
const verificarTamanhoTela = () => {
  // Em desktop (lg+), sidebar sempre visível
  // Em mobile, mantém o estado atual do usuário
  if (window.innerWidth >= 1024) {
    // Em desktop, não precisa controlar o estado
    // A sidebar será sempre visível via CSS
  } else {
    // Em mobile, fecha a sidebar se estiver aberta ao redimensionar
    isSidebarOpen.value = false
  }
}

onMounted(() => {
  verificarTamanhoTela()
  window.addEventListener('resize', verificarTamanhoTela)
})

onUnmounted(() => {
  window.removeEventListener('resize', verificarTamanhoTela)
})

watch(
  () => currentUser.value?.company?.theme,
  (theme) => {
    setBrandThemeFromCompany(theme)
  },
  { immediate: true },
)

watch(
  () => currentUser.value?.company?.faviconUrl,
  (faviconUrl) => setBrowserFavicon(faviconUrl),
  { immediate: true },
)

watch(
  () =>
    [currentUser.value?.username, currentUser.value?.name, currentUser.value?.companyId] as const,
  ([username, userName, companyId]) => {
    if (username && userName && companyId) {
      const storedTheme = getSessionForUsername(username)?.colorTheme
      if (storedTheme) setTheme(storedTheme)
      rememberLastSession({
        username,
        userName,
        companyId,
        colorTheme: storedTheme ?? theme.value,
      })
    }
  },
  { immediate: true },
)

watch(theme, (colorTheme) => {
  const user = currentUser.value
  if (!user?.username || !user.name || !user.companyId) return
  rememberLastSession({
    username: user.username,
    userName: user.name,
    companyId: user.companyId,
    colorTheme,
  })
})

const hasPermission = (key: ResourceKey) =>
  Boolean(currentUser.value?.root || currentUser.value?.permissions?.includes(key))

const navigationItems = computed(() =>
  [
    ...(hasPermission('dashboard')
      ? [{ name: t('navigation.dashboard'), href: '/', icon: ChartNoAxesColumn }]
      : []),
    {
      name: t('navigation.registrations'),
      icon: UserCheck,
      children: [
        ...(hasPermission('users')
          ? [{ name: t('navigation.users'), href: '/users', icon: Users }]
          : []),
        ...(currentUser.value?.roleRoot && hasPermission('roles')
          ? [{ name: 'Roles', href: '/roles', icon: ShieldCheck }]
          : []),
        ...(hasPermission('clients')
          ? [{ name: t('navigation.clients'), href: '/clients', icon: UsersRound }]
          : []),
        ...(currentUser.value?.root && hasPermission('companies')
          ? [{ name: t('navigation.companies'), href: '/companies', icon: Building2 }]
          : []),
      ],
    },
    ...(hasPermission('leads')
      ? [{ name: t('navigation.leads'), href: '/leads', icon: DollarSign }]
      : []),
    ...(hasPermission('cases')
      ? [{ name: t('navigation.cases'), href: '/cases', icon: Scale }]
      : []),
    ...(hasPermission('aima')
      ? [{ name: t('navigation.aima'), href: '/aima', icon: AimaFaviconIcon }]
      : []),
    ...(hasPermission('niss')
      ? [{ name: t('navigation.niss'), href: '/niss', icon: SocialSecurityIcon }]
      : []),
  ].filter((item) => !item.children || item.children.length > 0),
)

// Toggle submenu
const toggleSubmenu = (menuName: string) => {
  openSubmenus.value[menuName] = !openSubmenus.value[menuName]
}

// Auto-open submenu if current route is a child
watch(
  () => route.path,
  (newPath) => {
    navigationItems.value.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => child.href === newPath)
        if (hasActiveChild) {
          openSubmenus.value[item.name] = true
        }
      }
    })
  },
  { immediate: true },
)

const currentPageTitle = computed(() => {
  // Check if current route is a child of a submenu
  for (const item of navigationItems.value) {
    if (item.children) {
      const child = item.children.find((child) => child.href === route.path)
      if (child) {
        return child.name
      }
    } else if (item.href === route.path) {
      return item.name
    }
  }
  return t('navigation.dashboard')
})
</script>
