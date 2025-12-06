import { ReactNode, HTMLAttributes } from 'react';

interface SectionWrapperProps extends HTMLAttributes<HTMLElement> {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export const SectionWrapper = ({
  id,
  title,
  subtitle,
  description,
  children,
  className = '',
  ...props
}: SectionWrapperProps) => {
  return (
    <section id={id} className={`section-spacing ${className}`} {...props}>
      {(title || subtitle || description) && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center">
          {subtitle && (
            <p className="text-wy-primary uppercase tracking-[0.3em] text-xs mb-4">{subtitle}</p>
          )}
          {title && <h2 className="typography-section mb-4">{title}</h2>}
          {description && <p className="typography-base text-wy-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
};
