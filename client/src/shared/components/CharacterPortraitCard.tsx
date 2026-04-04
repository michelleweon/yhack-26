import { HEIST_CHARACTERS, getCharacterAvatarVisual } from '@/constants/characters';

interface CharacterPortraitCardProps {
  characterIndex: number;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isDimmed?: boolean;
  isEliminated?: boolean;
  imageScaleMultiplier?: number;
  nameVariant?: 'badge' | 'heading';
}

const SIZE_STYLES = {
  sm: {
    wrapper: 'gap-2',
    frame: 'h-24 w-20',
    image: 'h-24 w-20',
    name: 'px-3 py-1 text-[10px]',
    role: 'text-[10px]',
  },
  md: {
    wrapper: 'gap-2.5',
    frame: 'h-32 w-24',
    image: 'h-32 w-24',
    name: 'px-3 py-1 text-[11px]',
    role: 'text-[10px]',
  },
  lg: {
    wrapper: 'gap-3',
    frame: 'h-36 w-28',
    image: 'h-36 w-28',
    name: 'px-4 py-1.5 text-xs',
    role: 'text-[11px]',
  },
  xl: {
    wrapper: 'gap-4',
    frame: 'h-48 w-36',
    image: 'h-48 w-36',
    name: 'px-5 py-2 text-sm',
    role: 'text-xs',
  },
} as const;

export function CharacterPortraitCard({
  characterIndex,
  name,
  size = 'md',
  isDimmed = false,
  isEliminated = false,
  imageScaleMultiplier = 1,
  nameVariant = 'badge',
}: CharacterPortraitCardProps) {
  const visual = getCharacterAvatarVisual(characterIndex);
  const sizeStyles = SIZE_STYLES[size];

  return (
    <div className={`flex flex-col items-center text-center ${sizeStyles.wrapper}`}>
      <div className={`flex items-end justify-center ${sizeStyles.frame}`}>
        <img
          src={visual.image}
          alt={`${visual.label} raccoon`}
          className={`${sizeStyles.image} object-contain object-bottom`}
          style={{
            transform: `scale(${visual.scale * imageScaleMultiplier})`,
            transformOrigin: 'bottom center',
            filter: isEliminated || isDimmed ? 'grayscale(100%)' : 'none',
            opacity: isEliminated ? 0.55 : isDimmed ? 0.45 : 1,
          }}
        />
      </div>

      {name && (
        nameVariant === 'heading' ? (
          <span className="max-w-full whitespace-normal break-words font-title text-2xl leading-none text-white">
            {name}
          </span>
        ) : (
          <span
            className={`max-w-full rounded-full border border-[#f59e0b]/25 bg-black/40 font-ui font-semibold tracking-[0.08em] text-[#f3c77a] shadow-[0_8px_24px_rgba(0,0,0,0.22)] ${sizeStyles.name}`}
          >
            {name}
          </span>
        )
      )}

    </div>
  );
}
