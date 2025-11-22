import { ComponentProps } from 'react';
import clsx from 'clsx';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ className, variant = 'primary', ...rest }: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
      : 'border border-indigo-400 text-indigo-200 hover:bg-indigo-900';

  return (
    <button
      className={clsx(
        'rounded-md px-3 py-2 text-sm font-medium shadow focus:outline-none focus:ring-2 focus:ring-indigo-300',
        styles,
        className,
      )}
      {...rest}
    />
  );
}

