import { strings } from '../../content/strings/en';

export function QuarterPrompt({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="qt">
      <div className="w-full max-w-sm rounded-lg bg-emerald-900 p-4 shadow-xl">
        <h2 id="qt" className="text-lg font-bold">{strings.quarterTitle}</h2>
        <p className="mt-2 text-sm text-emerald-100">{strings.quarterBody}</p>
        <button autoFocus className="mt-4 h-11 w-full rounded bg-white font-semibold text-emerald-950" onClick={onConfirm}>
          {strings.quarterConfirm}
        </button>
      </div>
    </div>
  );
}
