<template>
  <Button
    variant="outline"
    size="sm"
    @click="toggleTheme"
    class="h-9 w-9 p-0"
    :title="getTooltipText()"
  >
    <Sun v-if="effectiveTheme === 'dark'" class="h-4 w-4 rotate-0 scale-100 transition-all" />
    <Moon
      v-else-if="effectiveTheme === 'light'"
      class="h-4 w-4 rotate-0 scale-100 transition-all"
    />
    <Monitor v-else class="h-4 w-4 rotate-0 scale-100 transition-all" />
    <span class="sr-only">{{ getTooltipText() }}</span>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import Button from './Button.vue'
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const { theme, getEffectiveTheme, toggleTheme } = useTheme()

const effectiveTheme = computed(() => getEffectiveTheme())

const getTooltipText = () => {
  if (theme.value === 'system') {
    const currentTheme =
      effectiveTheme.value === 'dark' ? t('theme.darkLabel') : t('theme.lightLabel')
    return t('theme.system', { theme: currentTheme })
  } else if (theme.value === 'light') {
    return t('theme.light')
  } else {
    return t('theme.dark')
  }
}
</script>
