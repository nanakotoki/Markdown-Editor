import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  className = '',
  disabled,
  title,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
  const sizes = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-9 px-3.5 text-[13px]'
  const variants: Record<string, string> = {
    default: 'bg-ink-100 text-ink-700 hover:bg-ink-200',
    primary: 'bg-accent-600 text-white shadow-sm hover:bg-accent-700',
    ghost: 'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
    outline: 'border border-ink-200 bg-surface text-ink-700 hover:border-accent-300 hover:text-accent-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function IconButton({
  children,
  onClick,
  title,
  active,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active ? 'bg-accent-50 text-accent-700' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Modal({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 'max-w-2xl',
  bodyClassName = '',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
  bodyClassName?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-solid/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-[94vw] ${width} -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-panel focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-3.5">
            <div className="flex items-start gap-2.5">
              {icon && <div className="mt-0.5 text-accent-600">{icon}</div>}
              <div>
                <Dialog.Title className="text-[15px] font-semibold text-ink-900">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="mt-0.5 text-[12px] text-ink-400">{subtitle}</Dialog.Description>}
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className={`max-h-[calc(100vh-220px)] overflow-auto px-5 py-4 ${bodyClassName}`}>{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex items-center rounded-lg bg-ink-100 p-0.5 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition ${
            value === o.value ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
  mono,
  onKeyDown,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  mono?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
}) {
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[13px] text-ink-800 outline-none transition placeholder:text-ink-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 ${
        mono ? 'font-mono text-[12.5px]' : ''
      } ${className}`}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  mono,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
  className?: string
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full resize-y rounded-lg border border-ink-200 bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-ink-800 outline-none transition placeholder:text-ink-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 ${
        mono ? 'font-mono text-[12.5px]' : ''
      } ${className}`}
    />
  )
}
