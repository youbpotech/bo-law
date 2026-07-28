<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useTheme } from '@/composables/useTheme'
import { clearAuthToken, setAuthToken } from '@/lib/auth'
import {
  getLastSession,
  getSessionForUsername,
  rememberLastSession,
  type LastSession,
} from '@/lib/last-session'
import { queryClient } from '@/lib/query-client'
import { setBrowserFavicon } from '@/lib/favicon'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const currentYear = new Date().getFullYear()
const initialSession = getLastSession()
const username = ref(initialSession?.username ?? '')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const companyName = ref<string | null>(null)
const logoUrl = ref<string | null>(null)
const loginBannerUrl = ref<string | null>(null)
const lastUserName = ref<string | null>(null)
const { theme, setTheme, setBrandThemeFromCompany } = useTheme()
const router = useRouter()
const route = useRoute()
let brandingRequestId = 0

function resetBranding(): void {
  companyName.value = null
  logoUrl.value = null
  loginBannerUrl.value = null
  setBrandThemeFromCompany('default')
  setBrowserFavicon()
}

async function applyUserSession(session: LastSession | null): Promise<void> {
  const requestId = ++brandingRequestId
  if (!session) {
    lastUserName.value = null
    setTheme('system')
    resetBranding()
    return
  }

  lastUserName.value = session.userName ?? null
  setTheme(session.colorTheme ?? 'system')
  try {
    const response = await fetch(`${API_BASE_URL}/api/branding/companies/${session.companyId}`)
    if (!response.ok) throw new Error('Empresa não encontrada')
    const company = (await response.json()) as {
      name: string
      theme: string
      logoUrl: string | null
      faviconUrl: string | null
      loginBannerUrl: string | null
    }
    if (requestId !== brandingRequestId) return
    companyName.value = company.name
    logoUrl.value = company.logoUrl ? `${API_BASE_URL}${company.logoUrl}` : null
    loginBannerUrl.value = company.loginBannerUrl
      ? `${API_BASE_URL}${company.loginBannerUrl}`
      : null
    setBrandThemeFromCompany(company.theme)
    setBrowserFavicon(company.faviconUrl ? `${API_BASE_URL}${company.faviconUrl}` : null)
  } catch {
    if (requestId !== brandingRequestId) return
    resetBranding()
  }
}

watch(
  username,
  (login) => {
    void applyUserSession(getSessionForUsername(login))
  },
  { immediate: true },
)

async function handleLogin(): Promise<void> {
  errorMessage.value = ''
  isLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      errorMessage.value = body?.error ?? 'Não foi possível entrar.'
      return
    }

    const body = (await response.json()) as { token: string }
    queryClient.clear()
    clearAuthToken()
    setAuthToken(body.token)
    const meResponse = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${body.token}` },
    })
    if (!meResponse.ok) throw new Error('Não foi possível carregar a sessão')
    const user = (await meResponse.json()) as {
      name: string
      username: string
      companyId: number
      company?: { theme?: string; faviconUrl?: string | null } | null
    }
    rememberLastSession({
      username: user.username,
      userName: user.name,
      companyId: user.companyId,
      colorTheme: theme.value,
    })
    setBrandThemeFromCompany(user.company?.theme)
    setBrowserFavicon(user.company?.faviconUrl)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch {
    clearAuthToken()
    errorMessage.value = 'Não foi possível conectar ao servidor.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-muted/40 md:grid md:grid-cols-[minmax(0,3fr)_minmax(400px,2fr)]">
    <div class="relative min-h-56 overflow-hidden bg-primary/10 md:min-h-screen">
      <img
        v-if="loginBannerUrl"
        :src="loginBannerUrl"
        :alt="companyName ? `Banner de ${companyName}` : 'Banner da empresa'"
        class="absolute inset-0 h-full w-full object-cover"
      />
    </div>

    <div class="flex min-h-[calc(100vh-14rem)] flex-col bg-muted/40 md:min-h-screen">
      <main class="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-10">
        <div
          class="w-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
        >
          <div
            v-if="logoUrl"
            class="flex min-h-24 items-center justify-center border-b bg-background p-4"
          >
            <img
              :src="logoUrl"
              :alt="companyName || 'Logomarca da empresa'"
              class="max-h-20 max-w-full object-contain"
            />
          </div>
          <div class="p-6">
            <div>
              <h1 class="text-2xl font-semibold tracking-tight">Bem vindo de volta</h1>
              <p v-if="lastUserName" class="mt-1 text-xl font-semibold tracking-tight">
                {{ lastUserName }}
              </p>
            </div>

            <form class="mt-6 space-y-4" @submit.prevent="handleLogin">
              <div class="space-y-2">
                <label for="username" class="text-sm font-medium">Usuário</label>
                <Input
                  id="username"
                  v-model="username"
                  type="text"
                  autocomplete="username"
                  required
                />
              </div>
              <div class="space-y-2">
                <label for="password" class="text-sm font-medium">Senha</label>
                <Input
                  id="password"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  autofocus
                />
              </div>
              <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
              <Button type="submit" class="w-full" :disabled="isLoading">
                {{ isLoading ? 'Entrando...' : 'Entrar' }}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <footer class="border-t bg-background/80 px-6 py-3 text-center text-xs text-muted-foreground">
        Copyright YouBPO - {{ currentYear }} - v. 0.1
      </footer>
    </div>
  </div>
</template>
