<template>
  <input
    :class="
      cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        classValue,
      )
    "
    :type="props.type"
    :value="modelValue ?? ''"
    @input="handleInput"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiInput' })

interface Props {
  modelValue?: string | number
  type?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
})
const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const classValue = computed(() => attrs.class as ClassValue)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>
