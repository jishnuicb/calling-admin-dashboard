import { useState } from 'react';
import { Button, Modal } from './ui';

const DEFAULT_MAX = 80;

/** Short preview in lists; opens a modal for the full string when clipped. */
export function ClippedText({
  text,
  max = DEFAULT_MAX,
  className = 'text-xs text-ink-500',
  title = 'Full description',
}) {
  const [open, setOpen] = useState(false);
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const clipped = raw.length > max;
  const preview = clipped ? `${raw.slice(0, max).trimEnd()}…` : raw;

  return (
    <>
      <div className="min-w-0 max-w-[16rem]">
        <p className={`break-all ${className}`}>{preview}</p>
        {clipped && (
          <button
            type="button"
            className="mt-0.5 text-[11px] font-medium text-brand-600 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            View full
          </button>
        )}
      </div>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={title}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          }
        >
          <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-all text-sm text-ink-700">
            {raw}
          </p>
        </Modal>
      )}
    </>
  );
}
