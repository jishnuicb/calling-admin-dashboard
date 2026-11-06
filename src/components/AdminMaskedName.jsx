import { maskBadWords } from '../lib/maskBadWords';

/**
 * Admin-only name display.
 * Prefers API-masked `name` + additive `originalName` when present;
 * otherwise masks locally for older payloads.
 */
export function AdminMaskedName({
  name,
  originalName,
  emptyLabel = 'Unnamed',
  className = '',
  primaryClassName = 'truncate font-medium text-ink-900',
  originalClassName = 'truncate text-[11px] text-ink-500',
}) {
  const fromApi =
    originalName != null && String(originalName) !== '' && String(originalName) !== String(name || '');
  const local = maskBadWords(originalName || name);
  const display = fromApi ? name || emptyLabel : local.display || emptyLabel;
  const original = fromApi ? originalName : local.hasBadWord ? local.original : null;
  const showOriginal = Boolean(original && String(original) !== String(display));

  return (
    <div className={className}>
      <p className={primaryClassName} title={showOriginal ? original : display}>
        {display}
      </p>
      {showOriginal ? (
        <p className={originalClassName} title={original}>
          Original: {original}
        </p>
      ) : null}
    </div>
  );
}
