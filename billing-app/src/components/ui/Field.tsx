import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

const control =
  'h-10 w-full rounded-[6px] border border-default bg-surface px-3 text-[14px] text-primary ' +
  'placeholder:text-muted transition-colors duration-[120ms] hover:border-action ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

export function Label({
  htmlFor,
  required,
  children,
  className,
}: {
  htmlFor?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-[14px] font-semibold text-primary', className)}>
      {children}
      {required && (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}

interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: (id: string, describedBy: string | undefined) => ReactNode
  className?: string
}

/** Label + control + hint/error, wired together with the right aria plumbing. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children(id, describedBy)}
      {error ? (
        <p id={errorId} className="text-[12.5px] leading-4 text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] leading-4 text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'num', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'h-auto min-h-[80px] resize-y py-2', className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="checkbox"
        className="size-4 shrink-0 cursor-pointer accent-[var(--vero-action)]"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-[14px] text-primary select-none">
        {label}
      </label>
    </div>
  )
}

export function Radio({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="radio"
        className="size-4 shrink-0 cursor-pointer accent-[var(--vero-action)]"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-[14px] text-primary select-none">
        {label}
      </label>
    </div>
  )
}
