import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'

/* Four states, matching how production renders them:
 *   primary     navy fill, white label
 *   secondary   white fill, grey border, dark label
 *   destructive solid red
 *   tertiary    text-only, for low-weight inline actions
 * Disabled is a flat grey fill in every variant. */
type Variant = 'primary' | 'secondary' | 'destructive' | 'tertiary'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** React 19 passes ref as an ordinary prop; no forwardRef wrapper needed. */
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-action text-on-action border border-action hover:bg-action-hover hover:border-action-hover',
  secondary:
    'bg-surface text-primary border border-default hover:bg-action-wash hover:border-action',
  destructive:
    'bg-danger text-white border border-danger hover:brightness-90',
  tertiary:
    'bg-transparent text-action border border-transparent hover:bg-action-wash',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[14px]',
  md: 'h-10 px-4 text-[14px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-semibold',
        'transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
        'disabled:cursor-not-allowed disabled:border-[#E6E9ED] disabled:bg-[#E6E9ED] disabled:text-muted disabled:hover:bg-[#E6E9ED]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
