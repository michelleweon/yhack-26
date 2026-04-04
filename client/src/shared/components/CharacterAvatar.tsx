import { HEIST_CHARACTERS, getCharacterAvatarVisual } from '@/constants/characters';

interface CharacterAvatarProps {
  characterIndex: number;
  size?: number;
  showRole?: boolean;
  isEliminated?: boolean;
  isDisconnected?: boolean;
}

export function CharacterAvatar({
  characterIndex,
  size = 48,
  showRole = false,
  isEliminated = false,
  isDisconnected = false,
}: CharacterAvatarProps) {
  const character = HEIST_CHARACTERS[characterIndex] ?? HEIST_CHARACTERS[0];
  const avatarVisual = getCharacterAvatarVisual(characterIndex);
  const outerSize = size;
  const innerSize = size * 0.9;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: outerSize,
          height: outerSize,
          opacity: isEliminated ? 0.4 : isDisconnected ? 0.6 : 1,
          filter: isEliminated ? 'grayscale(80%)' : 'none',
        }}
      >
        <div
          className="relative overflow-hidden rounded-full"
          style={{ width: innerSize, height: innerSize }}
        >
          <img
            src={avatarVisual.image}
            alt=""
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-full w-full object-contain object-bottom"
            style={{
              transform: `translateX(-50%) scale(${avatarVisual.scale})`,
              transformOrigin: 'bottom center',
            }}
          />
        </div>
        {isEliminated && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width={outerSize} height={outerSize} viewBox={`0 0 ${outerSize} ${outerSize}`}>
              <line x1={outerSize * 0.2} y1={outerSize * 0.2} x2={outerSize * 0.8} y2={outerSize * 0.8} stroke="#e53e3e" strokeWidth={3} strokeLinecap="round" />
              <line x1={outerSize * 0.8} y1={outerSize * 0.2} x2={outerSize * 0.2} y2={outerSize * 0.8} stroke="#e53e3e" strokeWidth={3} strokeLinecap="round" />
            </svg>
          </div>
        )}
        {isDisconnected && (
          <div
            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-gray-500 border-2 border-vault-dark"
            style={{ width: size * 0.25, height: size * 0.25 }}
          />
        )}
      </div>
      {showRole && (
        <span className="font-ui text-xs text-gray-400 uppercase tracking-wider">
          {character.role}
        </span>
      )}
    </div>
  );
}
