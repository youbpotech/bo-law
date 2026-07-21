<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import AppLayout from './components/layout/AppLayout.vue'
import { useTheme } from './composables/useTheme'
import { useLanguage } from './composables/useLanguage'

// Initialize theme and language
const { initializeTheme } = useTheme()
const { initializeLanguage } = useLanguage()
const route = useRoute()
const shouldShowLayout = computed(() => !route.meta.hideLayout)

onMounted(() => {
  initializeTheme()
  initializeLanguage()
})
</script>

<template>
  <AppLayout v-if="shouldShowLayout">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
</template>
