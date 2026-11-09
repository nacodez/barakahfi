'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A side panel on desktop and a full-screen sheet on phones, built on the native <dialog>
 * element, which gives focus trapping, Esc to close and a backdrop with no extra code.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // A modal dialog makes the rest of the page inert. Next.js keeps a page mounted (but hidden)
    // after you navigate away, so close the dialog whenever this effect is torn down, or the
    // next page would be left unclickable behind an invisible modal.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground',
        'backdrop:bg-black/50 sm:left-auto sm:w-[34rem] sm:border-l sm:border-zinc-200 dark:sm:border-zinc-800',
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
