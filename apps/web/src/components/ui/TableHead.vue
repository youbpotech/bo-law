<template>
  <th
    :class="
      cn(
        'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
        classValue,
      )
    "
    v-bind="attrs"
  >
    <slot />
  </th>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
