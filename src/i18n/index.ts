import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import de from './locales/de.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Keep <html lang> in sync (screen readers, hyphenation, spell checking)
const syncLang = (lng?: string) => {
  if (typeof document !== 'undefined' && lng) document.documentElement.lang = lng.split('-')[0]
}
syncLang(i18n.language)
i18n.on('languageChanged', syncLang)

export default i18n
