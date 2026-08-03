<template>
  <!-- Overlay para mobile -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden"
    @click="emit('close')"
  />

  <!-- Sidebar -->
  <aside
    :class="
      cn(
        'fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-background transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
        // Em mobile, controla visibilidade via isOpen
        // Em desktop (lg+), sempre visível (lg:translate-x-0 sobrescreve)
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        classValue,
      )
    "
    v-bind="attrs"
  >
    <div
      class="relative flex h-16 shrink-0 items-center overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-px after:bg-border after:content-['']"
    >
      <img
        v-if="resolvedLogoUrl"
        :src="resolvedLogoUrl"
        :alt="companyName || 'Logomarca da empresa'"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <h2 v-else class="px-6 text-lg font-semibold">Backoffice Jurídico</h2>
      <button
        type="button"
        @click="$emit('close')"
        class="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md bg-background/80 p-1 backdrop-blur-sm hover:bg-accent lg:hidden"
        aria-label="Fechar menu"
      >
        <X class="h-5 w-5" />
      </button>
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto p-4">
      <slot />
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { X } from 'lucide-vue-next'
import { getAuthToken } from '@/lib/auth'
import { DEFAULT_COMPANY_LOGO_URL } from '@/lib/branding'

defineOptions({ name: 'AppSidebar' })

interface Props {
  isOpen?: boolean
  logoUrl?: string | null
  companyName?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: true,
  logoUrl: null,
  companyName: null,
})

const resolvedLogoUrl = ref<string | null>(DEFAULT_COMPANY_LOGO_URL)
let objectUrl: string | null = null

function clearObjectUrl(): void {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = null
  resolvedLogoUrl.value = DEFAULT_COMPANY_LOGO_URL
}

watch(
  () => props.logoUrl,
  async (logoUrl) => {
    clearObjectUrl()
    if (!logoUrl) return
    try {
      const response = await fetch(logoUrl, {
        headers: { Authorization: `Bearer ${getAuthToken() ?? ''}` },
      })
      if (!response.ok) return
      objectUrl = URL.createObjectURL(await response.blob())
      resolvedLogoUrl.value = objectUrl
    } catch {
      clearObjectUrl()
    }
  },
  { immediate: true },
)

onBeforeUnmount(clearObjectUrl)

const emit = defineEmits<{
  close: []
}>()

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
