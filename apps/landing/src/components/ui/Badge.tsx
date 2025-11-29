import { ReactNode, HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'primary' | 'secondary'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: ReactNode
}

const variantClasses = {
  default: 'bg-wy-bg-subtle text-wy-text',
  primary: 'bg-wy-primary-soft text-wy-primary',
  secondary: 'bg-blue-50 text-blue-600',
}

export const Badge = ({ variant = 'default', children, className = '', ...props }: BadgeProps) => {
  const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold'
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  )
}
