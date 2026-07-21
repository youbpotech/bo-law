<template>
  <textarea
    :class="
      cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        classValue,
      )
    "
    :value="props.modelValue ?? ''"
    @input="handleInput"
    v-bind="attrs"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiTextarea' })

interface Props {
  modelValue?: string | number
}

const props = defineProps<Props>()
const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>
