<template>
  <thead :class="cn('[&_tr]:border-b', classValue)" v-bind="attrs">
    <slot />
  </thead>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)
</script>
