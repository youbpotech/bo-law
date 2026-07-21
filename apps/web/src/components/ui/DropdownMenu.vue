<template>
  <div ref="rootRef" class="relative inline-block">
    <slot name="trigger" :open="open" :toggle="toggle" :close="close" />

    <div
      v-if="open"
      :class="
        cn(
          'absolute z-20 mt-2 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          align === 'start' ? 'left-0' : 'right-0',
        )
      "
    >
      <slot :close="close" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: boolean
  align?: 'start' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  align: 'end',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const rootRef = ref<HTMLElement | null>(null)
const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const toggle = () => {
  open.value = !open.value
}

const close = () => {
  open.value = false
}

const handleOutsideClick = (event: MouseEvent) => {
  if (!rootRef.value) {
    return
  }

  const target = event.target as Node
  if (!rootRef.value.contains(target)) {
    close()
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleOutsideClick)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleOutsideClick)
  window.removeEventListener('keydown', handleEscape)
})
</script>
