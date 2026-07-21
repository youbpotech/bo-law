<template>
  <div class="relative w-full overflow-auto">
    <table :class="cn('w-full caption-bottom text-sm', classValue)" v-bind="attrs">
      <slot />
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiTable' })

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
