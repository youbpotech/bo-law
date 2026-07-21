<template>
  <a
    :class="
      cn(
        'inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
        classValue,
      )
    "
    v-bind="attrs"
  >
    <slot />
  </a>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
