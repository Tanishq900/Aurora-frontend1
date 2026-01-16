import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string };

interface AuroraSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export default function AuroraSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  className,
  buttonClassName,
  menuClassName,
}: AuroraSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const selectedLabel = useMemo(() => {
    return options.find((o) => o.value === value)?.label ?? '';
  }, [options, value]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current && rootRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setMenuPos({
        left: rect.left,
        top: rect.bottom + 8,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const label = selectedLabel || placeholder;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        ref={buttonRef}
        className={cn(
          'w-52 px-4 py-2 bg-secondary/60 border border-border/50 rounded-lg text-foreground',
          'inline-flex items-center justify-between gap-3',
          'transition-colors hover:bg-secondary/80',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
          buttonClassName
        )}
      >
        <span className={cn('truncate', selectedLabel ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('transition-transform', open ? 'rotate-180' : 'rotate-0')}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              id={id}
              role="listbox"
              className={cn('z-[99999]', menuClassName)}
              style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, width: menuPos.width }}
            >
              <div className={cn('glass-panel overflow-hidden', 'border border-border/60')}>
                <div className="p-1">
                  {options.map((opt) => {
                    const active = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md',
                          'transition-colors',
                          active
                            ? 'bg-secondary/70 text-foreground border border-border/50'
                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
