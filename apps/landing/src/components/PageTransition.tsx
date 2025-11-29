import { ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [transitionStage, setTransitionStage] = useState<'entering' | 'entered'>('entered')

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('entering')
      const timer = setTimeout(() => {
        setDisplayLocation(location)
        setTransitionStage('entered')
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [location, displayLocation])

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      className={`transition-opacity duration-300 ${
        transitionStage === 'entering' && !prefersReducedMotion ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {children}
    </div>
  )
}

