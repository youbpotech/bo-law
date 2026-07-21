import { ref, watch } from 'vue'
import { isBrandTheme, type BrandTheme } from '@/lib/company-themes'

type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>('system')
const systemTheme = ref<'light' | 'dark'>('light')
const brandTheme = ref<BrandTheme>('default')
const isInitialized = ref(false)

const colorThemes: Theme[] = ['light', 'dark', 'system']

const getMediaQuery = () => {
  if (typeof window === 'undefined') return null
  return window.matchMedia('(prefers-color-scheme: dark)')
}

export function useTheme() {
  const toggleTheme = () => {
    if (theme.value === 'system') {
      theme.value = 'light'
    } else if (theme.value === 'light') {
      theme.value = 'dark'
    } else {
      theme.value = 'system'
    }
  }

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  const setBrandTheme = (newTheme: BrandTheme) => {
    brandTheme.value = newTheme
  }

  const setBrandThemeFromCompany = (newTheme: string | null | undefined) => {
    brandTheme.value = newTheme && isBrandTheme(newTheme) ? newTheme : 'default'
  }

  // Get the effective theme (resolves 'system' to actual light/dark)
  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (theme.value === 'system') {
      return systemTheme.value
    }
    return theme.value
  }

  // Watch for theme changes and update DOM
  watch(
    [theme, systemTheme, brandTheme],
    () => {
      if (typeof document === 'undefined' || typeof localStorage === 'undefined') return

      const effectiveTheme = getEffectiveTheme()
      const root = document.documentElement

      if (effectiveTheme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }

      root.dataset.theme = brandTheme.value

      // Store theme preference in localStorage
      localStorage.setItem('theme', theme.value)
    },
    { immediate: true },
  )

  // Listen for system theme changes
  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    systemTheme.value = e.matches ? 'dark' : 'light'
  }

  // Initialize theme from localStorage or system preference
  const initializeTheme = () => {
    if (isInitialized.value || typeof localStorage === 'undefined') return

    const savedTheme = localStorage.getItem('theme') as Theme

    if (savedTheme && colorThemes.includes(savedTheme)) {
      theme.value = savedTheme
    } else {
      theme.value = 'system'
    }

    // Set initial system theme
    const mediaQuery = getMediaQuery()
    systemTheme.value = mediaQuery?.matches ? 'dark' : 'light'

    // Listen for system theme changes
    mediaQuery?.addEventListener('change', handleSystemThemeChange)
    isInitialized.value = true
  }

  const cleanup = () => {
    getMediaQuery()?.removeEventListener('change', handleSystemThemeChange)
    isInitialized.value = false
  }

  return {
    theme,
    systemTheme,
    brandTheme,
    getEffectiveTheme,
    toggleTheme,
    setTheme,
    setBrandTheme,
    setBrandThemeFromCompany,
    initializeTheme,
    cleanup,
  }
}
