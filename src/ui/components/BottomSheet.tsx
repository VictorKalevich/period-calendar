import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Нижний лист на нативном <dialog>: фокус-ловушка через showModal, закрытие свайпом вниз или по фону. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onTouchStart={(e) => {
        dragStart.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        const start = dragStart.current;
        const end = e.changedTouches[0]?.clientY;
        dragStart.current = null;
        if (start !== null && end !== undefined && end - start > 80) onClose();
      }}
    >
      <div className="sheet__body">
        <div className="sheet__grip" aria-hidden="true" />
        <h2 className="t-card-title sheet__title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
