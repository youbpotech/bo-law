<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, LoaderCircle, Plus } from 'lucide-vue-next'
import {
  createCountry,
  createState,
  searchCountries,
  searchStates,
  type GeographyOption,
} from '@/lib/geography'

interface Props {
  modelValue?: string | number
  selectedLabel?: string | number
  kind: 'country' | 'state'
  country?: string | number
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  selectedLabel: '',
  country: '',
  placeholder: 'Pesquisar...',
})
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'update:selectedLabel', value: string): void
  (event: 'selected', option: GeographyOption): void
}>()

const query = ref(String(props.selectedLabel || props.modelValue || ''))
const options = ref<GeographyOption[]>([])
const open = ref(false)
const loading = ref(false)
const creating = ref(false)
const error = ref('')
let searchSequence = 0
let timer: ReturnType<typeof setTimeout> | undefined

const canCreate = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase()
  return (
    normalized.length >= 2 &&
    !options.value.some((option) => option.label.toLocaleLowerCase() === normalized)
  )
})

watch(
  () => [props.modelValue, props.selectedLabel] as const,
  ([value, label]) => {
    if (!open.value) {
      query.value = String(label || value || '')
      if (value && !label) void resolveSelectedLabel(String(value))
    }
  },
  { immediate: true },
)

watch(
  () => props.country,
  () => {
    if (props.kind === 'state') {
      options.value = []
      query.value = String(props.selectedLabel || '')
    }
  },
)

function scheduleSearch(): void {
  open.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void loadOptions(), 250)
}

async function resolveSelectedLabel(value: string): Promise<void> {
  try {
    const result =
      props.kind === 'country'
        ? await searchCountries(value)
        : props.country
          ? await searchStates(String(props.country), value)
          : []
    const selected = result.find((option) => option.value === value)
    if (selected && !open.value) query.value = selected.label
  } catch {
    // Mantém o código armazenado quando a referência não estiver disponível.
  }
}

async function loadOptions(): Promise<void> {
  if (props.kind === 'state' && !props.country) {
    options.value = []
    return
  }
  const sequence = ++searchSequence
  loading.value = true
  error.value = ''
  try {
    const result =
      props.kind === 'country'
        ? await searchCountries(query.value.trim())
        : await searchStates(String(props.country), query.value.trim())
    if (sequence === searchSequence) options.value = result
  } catch (caughtError) {
    if (sequence === searchSequence) {
      error.value =
        caughtError instanceof Error ? caughtError.message : 'Não foi possível pesquisar.'
    }
  } finally {
    if (sequence === searchSequence) loading.value = false
  }
}

function select(option: GeographyOption): void {
  emit('update:modelValue', option.value)
  emit('update:selectedLabel', option.label)
  emit('selected', option)
  query.value = option.label
  open.value = false
  error.value = ''
}

async function createOption(): Promise<void> {
  const name = query.value.trim()
  if (!canCreate.value) return
  creating.value = true
  error.value = ''
  try {
    const option =
      props.kind === 'country'
        ? await createCountry(name)
        : await createState(String(props.country), name)
    select(option)
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível cadastrar.'
  } finally {
    creating.value = false
  }
}

function closeSoon(): void {
  window.setTimeout(() => {
    open.value = false
    if (!props.modelValue) query.value = ''
    else if (props.selectedLabel) query.value = String(props.selectedLabel)
  }, 150)
}
</script>

<template>
  <div class="relative">
    <div class="relative">
      <input
        v-model="query"
        type="text"
        autocomplete="off"
        :placeholder="placeholder"
        :disabled="kind === 'state' && !country"
        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        role="combobox"
        :aria-expanded="open"
        @focus="scheduleSearch"
        @input="scheduleSearch"
        @blur="closeSoon"
      />
      <LoaderCircle
        v-if="loading"
        class="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground"
      />
      <ChevronDown
        v-else
        class="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground"
      />
    </div>

    <div
      v-if="open"
      class="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
        @mousedown.prevent="select(option)"
      >
        <span>{{ option.label }}</span>
        <span class="flex items-center gap-2 text-xs text-muted-foreground">
          {{ option.custom ? 'Personalizado' : option.value }}
          <Check v-if="modelValue === option.value" class="h-4 w-4" />
        </span>
      </button>
      <button
        v-if="canCreate"
        type="button"
        class="mt-1 flex w-full items-center border-t px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
        :disabled="creating"
        @mousedown.prevent="createOption"
      >
        <LoaderCircle v-if="creating" class="mr-2 h-4 w-4 animate-spin" />
        <Plus v-else class="mr-2 h-4 w-4" />
        Cadastrar “{{ query.trim() }}”
      </button>
      <p
        v-if="!loading && !options.length && !canCreate"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Nenhum resultado encontrado.
      </p>
      <p v-if="error" class="px-3 py-2 text-sm text-destructive">{{ error }}</p>
    </div>
  </div>
</template>
