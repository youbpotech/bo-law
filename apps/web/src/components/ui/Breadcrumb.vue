<template>
  <nav :class="cn('flex', classValue)" v-bind="attrs">
    <ol class="flex items-center space-x-1 md:space-x-2">
      <slot />
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiBreadcrumb' })

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
