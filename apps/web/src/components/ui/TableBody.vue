<template>
  <tbody :class="cn('[&_tr:last-child]:border-0', classValue)" v-bind="attrs">
    <slot />
  </tbody>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
