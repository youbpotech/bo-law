<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useTheme } from '@/composables/useTheme'
import { clearAuthToken, setAuthToken } from '@/lib/auth'
import { getLastSession, rememberLastSession } from '@/lib/last-session'
import { queryClient } from '@/lib/query-client'
import { setBrowserFavicon } from '@/lib/favicon'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const currentYear = new Date().getFullYear()
const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const companyName = ref<string | null>(null)
const logoUrl = ref<string | null>(null)
const { setBrandThemeFromCompany } = useTheme()
const router = useRouter()
const route = useRoute()
const welcomeMessage = computed(() =>
  companyName.value ? `Bem-vindo de volta à ${companyName.value}` : 'Bem-vindo ao Backoffice Jurídico',
)

async function loadLastCompany(): Promise<void> {
  const lastSession = getLastSession()
  if (!lastSession) {
    setBrandThemeFromCompany('default')
    setBrowserFavicon()
    return
  }
  username.value = lastSession.username
  try {
    const response = await fetch(`${API_BASE_URL}/api/branding/companies/${lastSession.companyId}`)
    if (!response.ok) throw new Error('Empresa não encontrada')
    const company = (await response.json()) as {
      name: string
      theme: string
      logoUrl: string | null
      faviconUrl: string | null
    }
    companyName.value = company.name
    logoUrl.value = company.logoUrl ? `${API_BASE_URL}${company.logoUrl}` : null
    setBrandThemeFromCompany(company.theme)
    setBrowserFavicon(company.faviconUrl ? `${API_BASE_URL}${company.faviconUrl}` : null)
  } catch {
    companyName.value = null
    logoUrl.value = null
    setBrandThemeFromCompany('default')
    setBrowserFavicon()
  }
}

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
      username: string
      companyId: number
      company?: { theme?: string; faviconUrl?: string | null } | null
    }
    rememberLastSession({ username: user.username, companyId: user.companyId })
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

onMounted(loadLastCompany)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-muted/40">
    <main class="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-10">
      <div class="w-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        <div v-if="logoUrl" class="flex min-h-24 items-center justify-center border-b bg-background p-4">
          <img :src="logoUrl" :alt="companyName || 'Logomarca da empresa'" class="max-h-20 max-w-full object-contain" />
        </div>
        <div class="p-6">
          <div class="space-y-2">
            <h1 class="text-2xl font-semibold tracking-tight">{{ welcomeMessage }}</h1>
            <p class="text-sm text-muted-foreground">Use suas credenciais para acessar o painel.</p>
          </div>

          <form class="mt-6 space-y-4" @submit.prevent="handleLogin">
            <div class="space-y-2">
              <label for="username" class="text-sm font-medium">Usuário</label>
              <Input id="username" v-model="username" type="text" autocomplete="username" required />
            </div>
            <div class="space-y-2">
              <label for="password" class="text-sm font-medium">Senha</label>
              <Input id="password" v-model="password" type="password" autocomplete="current-password" required autofocus />
            </div>
            <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
            <Button type="submit" class="w-full" :disabled="isLoading">{{ isLoading ? 'Entrando...' : 'Entrar' }}</Button>
          </form>
        </div>
      </div>
    </main>
    <footer class="border-t bg-background/80 px-6 py-3 text-center text-xs text-muted-foreground">
      Copyright YouBPO - {{ currentYear }} - v. 0.1
    </footer>
  </div>
</template>
