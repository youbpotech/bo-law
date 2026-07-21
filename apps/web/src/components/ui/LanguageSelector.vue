<template>
  <div class="relative">
    <select
      :value="currentLanguage"
      @change="handleLanguageChange"
      class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option v-for="lang in supportedLanguages" :key="lang.value" :value="lang.value">
        {{ lang.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLanguage, type SupportedLanguage } from '@/composables/useLanguage'

const { currentLanguage, changeLanguage, getSupportedLanguages } = useLanguage()

const supportedLanguages = computed(() => getSupportedLanguages())

const handleLanguageChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  changeLanguage(target.value as SupportedLanguage)
}
</script>
