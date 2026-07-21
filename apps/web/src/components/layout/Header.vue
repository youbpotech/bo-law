<template>
  <header
    :class="cn('flex h-16 items-center justify-between border-b bg-background px-6', classValue)"
    v-bind="attrs"
  >
    <div class="flex items-center space-x-4">
      <button
        type="button"
        @click="emit('toggleSidebar')"
        class="lg:hidden rounded-md p-2 hover:bg-accent"
        aria-label="Abrir menu"
      >
        <Menu class="h-5 w-5" />
      </button>
      <slot name="breadcrumb" />
    </div>
    <div class="flex items-center space-x-4">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-vue-next'

defineOptions({ name: 'AppHeader' })

const emit = defineEmits<{
  toggleSidebar: []
}>()

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
