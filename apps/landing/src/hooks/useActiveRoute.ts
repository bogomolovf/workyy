import { useLocation } from 'react-router-dom'

export const useActiveRoute = () => {
  const location = useLocation()
  const pathname = location.pathname

  // Extract route without language prefix
  const route = pathname.replace(/^\/(en|ru)/, '') || '/home'

  // Check if a given path matches the current route
  const isActive = (path: string) => {
    const normalizedPath = path.replace(/^\/(en|ru)/, '') || '/home'
    return route === normalizedPath || route.startsWith(normalizedPath + '/')
  }

  return { route, isActive }
}

