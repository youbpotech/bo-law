<template>
  <div class="min-h-screen bg-muted/40">
    <div class="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <div class="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p class="text-sm text-muted-foreground">Use suas credenciais para acessar o painel.</p>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="handleLogin">
          <div class="space-y-2">
            <label for="username" class="text-sm font-medium">Usuário</label>
            <Input id="username" v-model="username" type="text" autocomplete="username" required />
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium">Senha</label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <p v-if="errorMessage" class="text-sm text-destructive">
            {{ errorMessage }}
          </p>

          <Button type="submit" class="w-full" :disabled="isLoading">
            {{ isLoading ? 'Entrando...' : 'Entrar' }}
          </Button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { setAuthToken } from '@/lib/auth'
import { queryClient } from '@/lib/query-client'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const router = useRouter()
const route = useRoute()

const handleLogin = async () => {
  errorMessage.value = ''
  isLoading.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      errorMessage.value = body?.error ?? 'Não foi possível entrar.'
      return
    }

    const body = (await response.json()) as { token: string }
    queryClient.clear()
    setAuthToken(body.token)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch {
    errorMessage.value = 'Não foi possível conectar ao servidor.'
  } finally {
    isLoading.value = false
  }
}
</script>
