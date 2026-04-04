import type { ReactNode } from 'react';
import { SettingsGear } from './SettingsGear';

interface PhoneLayoutProps {
  children: ReactNode;
  minimalSettingsGear?: boolean;
  backgroundImage?: string;
  overlayClassName?: string;
  contentClassName?: string;
  syncMessage?: string;
}

export function PhoneLayout({
  children,
  minimalSettingsGear = true,
  backgroundImage,
  overlayClassName = '',
  contentClassName = '',
  syncMessage = 'Refresh Page to Sync',
}: PhoneLayoutProps) {
  return (
    <div className="mobile-safe-frame relative w-full overflow-hidden bg-black">
      {backgroundImage ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
        </>
      ) : null}

      <div
        className={`mobile-safe-content relative z-10 flex min-h-[100dvh] flex-col overflow-y-auto px-5 text-white ${contentClassName}`}
      >
        <div className="flex min-h-full flex-1 flex-col">
          {children}
        </div>
        <p className="phone-sync-note mt-4 text-center">
          {syncMessage}
        </p>
      </div>
      <SettingsGear minimal={minimalSettingsGear} />
    </div>
  );
}
