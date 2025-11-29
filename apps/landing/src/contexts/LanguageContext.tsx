import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getContent, type Language, type Content } from '../data/content'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  content: Content
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const [language, setLanguageState] = useState<Language>(() => {
    const path = window.location.pathname
    if (path.startsWith('/ru/')) return 'ru'
    if (path.startsWith('/en/')) return 'en'
    const saved = localStorage.getItem('workyy-language') as Language
    return saved || 'en'
  })

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/ru/')) {
      setLanguageState('ru')
    } else if (path.startsWith('/en/')) {
      setLanguageState('en')
    }
  }, [location.pathname])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('workyy-language', lang)
  }

  const content = getContent(language)

  return (
    <LanguageContext.Provider value={{ language, setLanguage, content }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}

