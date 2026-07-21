<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
      @click="handleBackdropClick"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50" />

      <!-- Dialog -->
      <div
        :class="
          cn(
            'relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
            classValue,
          )
        "
        @click.stop
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiDialog', inheritAttrs: false })

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)

const handleBackdropClick = () => {
  emit('update:open', false)
}
</script>
