<template>
  <td :class="cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', classValue)" v-bind="attrs">
    <slot />
  </td>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
