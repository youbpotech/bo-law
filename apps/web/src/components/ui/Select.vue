<template>
  <div class="relative">
    <select
      :class="
        cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-background [&>option]:text-foreground',
          classValue,
        )
      "
      :value="props.modelValue?.toString() ?? ''"
      @change="handleChange"
      v-bind="attrs"
    >
      <slot />
    </select>
    <ChevronDown
      class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-vue-next'

defineOptions({ name: 'UiSelect' })

interface Props {
  modelValue?: string | number
}

const props = defineProps<Props>()
const attrs = useAttrs()
const classValue = computed(() => attrs.class as ClassValue)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  if (target.value === '') {
    emit('update:modelValue', undefined)
  } else {
    // Se o modelValue atual é number ou o valor pode ser convertido para number, converte
    // Isso suporta v-model.number
    const numValue = Number(target.value)
    const value = typeof props.modelValue === 'number' || !isNaN(numValue) ? numValue : target.value
    emit('update:modelValue', value)
  }
}
</script>
