import { ReactNode, HTMLAttributes } from 'react';

type CardVariant = 'default' | 'elevated' | 'bordered';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

const variantClasses = {
  default: 'bg-white border border-wy-border',
  elevated: 'bg-white border border-wy-border shadow-soft',
  bordered: 'bg-white border-2 border-wy-primary/30',
};

export const Card = ({ variant = 'default', children, className = '', ...props }: CardProps) => {
  const baseClasses = 'rounded-card p-6 transition-all hover:-translate-y-1 hover:shadow-md';
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
