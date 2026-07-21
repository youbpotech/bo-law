<template>
  <tr
    :class="
      cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', classValue)
    "
    v-bind="attrs"
  >
    <slot />
  </tr>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
