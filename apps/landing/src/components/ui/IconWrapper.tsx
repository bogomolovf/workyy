import { ReactNode, HTMLAttributes } from 'react'

interface IconWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
}

export const IconWrapper = ({ children, size = 'md', className = '', ...props }: IconWrapperProps) => {
  const baseClasses = 'flex items-center justify-center'
  const classes = `${baseClasses} ${sizeClasses[size]} ${className}`

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

