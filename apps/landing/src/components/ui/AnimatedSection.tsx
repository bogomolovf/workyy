import { ReactNode, HTMLAttributes } from 'react'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

interface AnimatedSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  delay?: number
  className?: string
}

export const AnimatedSection = ({ children, delay = 0, className = '', ...props }: AnimatedSectionProps) => {
  const { isVisible, elementRef } = useScrollAnimation(0.1)

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <section
      ref={elementRef as React.RefObject<HTMLElement>}
      className={`transition-all duration-700 ease-out ${
        isVisible || prefersReducedMotion
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      } ${className}`}
      style={delay > 0 && !prefersReducedMotion ? { transitionDelay: `${delay}ms` } : undefined}
      {...props}
    >
      {children}
    </section>
  )
}

