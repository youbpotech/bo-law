import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import ptBR from '../locales/pt-BR.json'
import es from '../locales/es.json'

const messages = {
  en,
  'pt-BR': ptBR,
  es,
}

const savedLanguage = localStorage.getItem('language') || 'pt-BR'

export const i18n = createI18n({
  legacy: false,
  locale: savedLanguage,
  fallbackLocale: 'pt-BR',
  messages,
  globalInjection: true,
})

export default i18n
