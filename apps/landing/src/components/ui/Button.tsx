import { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface BaseButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  className?: string
}

type ButtonProps = BaseButtonProps &
  (
    | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: never; to?: never })
    | (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; to?: never })
    | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & { to: string; href?: never; onClick?: (e?: React.MouseEvent<HTMLAnchorElement>) => void })
  )

const sizeClasses = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

const variantClasses = {
  primary: 'bg-wy-primary text-white hover:bg-wy-primary/90 font-semibold',
  secondary: 'border-2 border-wy-border text-wy-text hover:bg-wy-bg-subtle',
  ghost: 'text-wy-text hover:bg-wy-bg-subtle',
}

export const Button = ({ variant = 'primary', size = 'md', children, className = '', href, to, ...props }: ButtonProps) => {
  const baseClasses = 'rounded-lg transition-colors inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-wy-primary focus-visible:outline-offset-2'
  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    )
  }

  return (
    <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
