import { useLanguage } from '../contexts/LanguageContext'
import { useLocation, useNavigate } from 'react-router-dom'

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ru' : 'en'
    setLanguage(newLang)

    // Preserve current path and anchor
    const path = location.pathname
    const hash = location.hash
    let newPath = path

    if (path.startsWith('/en/')) {
      newPath = path.replace('/en/', '/ru/')
    } else if (path.startsWith('/ru/')) {
      newPath = path.replace('/ru/', '/en/')
    } else if (path === '/' || path === '') {
      newPath = `/${newLang}/home`
    } else {
      // If no language prefix, add one
      newPath = `/${newLang}${path}`
    }

    navigate(newPath + hash)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="px-3 py-1.5 rounded-lg border border-wy-border bg-white hover:bg-wy-bg-subtle transition-colors text-sm uppercase tracking-wider text-wy-text font-medium whitespace-nowrap w-[44px] text-center inline-block"
    >
      {language === 'en' ? 'RU' : 'EN'}
    </button>
  )
}

