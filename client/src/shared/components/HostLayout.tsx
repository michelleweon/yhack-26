import type { ReactNode } from 'react';
import { useGameState } from '@/context/GameContext';
import { SettingsGear } from './SettingsGear';
import defaultBackground from '@/assets/optimized/lobbyv2.webp';

interface HostLayoutProps {
  children: ReactNode;
  showBackground?: boolean;
  backgroundImage?: string;
  minimalSettingsGear?: boolean;
  settingsGearSide?: 'left' | 'right';
}

export function HostLayout({
  children,
  showBackground = true,
  backgroundImage,
  minimalSettingsGear = false,
  settingsGearSide = 'right',
}: HostLayoutProps) {
  const { phase, roomCode } = useGameState();
  const resolvedBackgroundImage = backgroundImage ?? defaultBackground;
  const shouldShowDefaultOverlay = !backgroundImage;
  const shouldShowPersistentRoomCode = Boolean(roomCode)
    && ['profile', 'question', 'results', 'leaderboard', 'win', 'gameover'].includes(phase);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-vault-darker">
      {showBackground && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${resolvedBackgroundImage})` }}
          />
          {shouldShowDefaultOverlay && <div className="absolute inset-0 bg-black/50" />}
        </>
      )}

      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>

      {shouldShowPersistentRoomCode && (
        <div
          className="pointer-events-none absolute z-30 flex h-10 items-center font-ui text-xs font-semibold uppercase tracking-[0.24em] text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]"
          style={{
            top: 'max(1rem, calc(env(safe-area-inset-top) + 0.75rem))',
            right: 'calc(env(safe-area-inset-right) + 4.25rem)',
          }}
        >
          Room {roomCode}
        </div>
      )}

      <SettingsGear minimal={minimalSettingsGear} side={settingsGearSide} />
    </div>
  );
}
