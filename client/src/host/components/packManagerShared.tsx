import { playSelectionDing } from '@/shared/services/selectionDing';
import type { CustomQuestionPack } from '@/types/game';

export const SAVED_PACK_PILL_CLASS =
  'inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-2 font-ui text-sm transition-colors';

export interface EmptyDocumentCandidate {
  label: string;
  rawTextLength: number;
  isLikelyImageOnlyPdf: boolean;
  exceededLimit: boolean;
  wasConvertedFromPdf: boolean;
}

export function shouldConfirmEmptyDocument({
  rawTextLength,
  isLikelyImageOnlyPdf,
}: Pick<EmptyDocumentCandidate, 'rawTextLength' | 'isLikelyImageOnlyPdf'>) {
  return rawTextLength < 20 || isLikelyImageOnlyPdf;
}

export function getEmptyDocumentWarning(label: string) {
  return `${label} looks empty or has almost no extractable text.`;
}

export function getFallbackPackWarning(label: string) {
  return `${label} was saved as a fallback pack because the upload did not contain enough usable text.`;
}

export function getFallbackGenerationError(
  label: string,
  reason: string | null,
) {
  if (reason?.trim()) {
    return `${label} could not generate usable questions, so a fallback pack was saved instead. ${reason.trim()}`;
  }

  return `${label} could not generate usable questions, so a fallback pack was saved instead.`;
}

export function getPackGenerationStatusMessage({
  label,
  exceededLimit,
  wasConvertedFromPdf,
}: Pick<EmptyDocumentCandidate, 'label' | 'exceededLimit' | 'wasConvertedFromPdf'>) {
  if (exceededLimit) {
    return `Generating questions for ${label} from sampled sections of the converted text...`;
  }

  if (wasConvertedFromPdf) {
    return `Converted ${label} to text. Generating questions...`;
  }

  return `Generating questions for ${label}...`;
}

interface SavedPackPillsProps {
  packs: CustomQuestionPack[];
  deletingPackId: string | null;
  getDisplayName: (pack: CustomQuestionPack) => string;
  onRequestDelete: (packId: string) => void;
  onToggle: (packId: string, enabled: boolean) => void;
  soundEffectsEnabled: boolean;
}

export function SavedPackPills({
  packs,
  deletingPackId,
  getDisplayName,
  onRequestDelete,
  onToggle,
  soundEffectsEnabled,
}: SavedPackPillsProps) {
  if (packs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="font-ui text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
        Saved Packs
      </p>
      <div className="flex flex-wrap gap-2">
        {packs.map(pack => {
          const isDeleting = deletingPackId === pack.id;

          return (
            <div key={pack.id} className="group relative">
              <button
                type="button"
                onClick={() => {
                  if (soundEffectsEnabled) {
                    playSelectionDing();
                  }

                  onToggle(pack.id, !pack.enabled);
                }}
                disabled={isDeleting}
                aria-pressed={pack.enabled}
                className={`${SAVED_PACK_PILL_CLASS} group-hover:pr-9 transition-[padding,color,border-color,background-color,opacity] duration-200 ${
                  pack.enabled
                    ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                    : 'border-white/15 text-white/85 hover:border-white/35 hover:bg-white/5'
                } ${isDeleting ? 'cursor-wait opacity-60' : ''}`}
              >
                {getDisplayName(pack)}
              </button>

              <button
                type="button"
                aria-label={`Delete ${getDisplayName(pack)}`}
                onClick={event => {
                  event.stopPropagation();
                  onRequestDelete(pack.id);
                }}
                disabled={isDeleting}
                className="pointer-events-none invisible absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 font-ui text-xs font-bold uppercase text-white/70 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 hover:border-white/25 hover:bg-black/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
