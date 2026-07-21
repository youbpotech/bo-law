import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export type SupportedLanguage = 'en' | 'pt-BR' | 'es'

const currentLanguage = ref<SupportedLanguage>('en')

export function useLanguage() {
  const { locale } = useI18n()

  // Initialize language from localStorage
  const initializeLanguage = () => {
    const savedLanguage = localStorage.getItem('language') as SupportedLanguage
    if (savedLanguage && ['en', 'pt-BR', 'es'].includes(savedLanguage)) {
      currentLanguage.value = savedLanguage
      locale.value = savedLanguage
    } else {
      currentLanguage.value = 'pt-BR'
      locale.value = 'pt-BR'
    }
  }

  // Change language
  const changeLanguage = (newLanguage: SupportedLanguage) => {
    currentLanguage.value = newLanguage
    locale.value = newLanguage
    localStorage.setItem('language', newLanguage)
  }

  // Watch for language changes and update localStorage
  watch(currentLanguage, (newLanguage) => {
    localStorage.setItem('language', newLanguage)
  })

  // Get language display name
  const getLanguageDisplayName = (lang: SupportedLanguage): string => {
    const names = {
      en: 'English',
      'pt-BR': 'Português (Brasil)',
      es: 'Español',
    }
    return names[lang]
  }

  // Get all supported languages
  const getSupportedLanguages = (): Array<{ value: SupportedLanguage; label: string }> => {
    return [
      { value: 'en', label: getLanguageDisplayName('en') },
      { value: 'pt-BR', label: getLanguageDisplayName('pt-BR') },
      { value: 'es', label: getLanguageDisplayName('es') },
    ]
  }

  return {
    currentLanguage,
    changeLanguage,
    initializeLanguage,
    getLanguageDisplayName,
    getSupportedLanguages,
  }
}
