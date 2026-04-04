import { useEffect } from 'react';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import { playButtonClickSound } from '@/shared/services/buttonClickSound';

const ACCENT_BUTTON_SELECTOR = [
  '[data-button-click-sound="accent"]',
  'button.vault-button',
  'button.minimal-button-primary',
  'button.bg-vault-gold',
  'a.vault-button',
  'a.minimal-button-primary',
  'a.bg-vault-gold',
  '[role="button"].vault-button',
  '[role="button"].minimal-button-primary',
  '[role="button"].bg-vault-gold',
].join(', ');

function isDisabledAccentButton(element: Element) {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

export function useAccentButtonClickSound() {
  const { soundEffectsEnabled } = useAudioSettings();

  useEffect(() => {
    if (!soundEffectsEnabled) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const accentButton = target.closest(ACCENT_BUTTON_SELECTOR);

      if (!accentButton || isDisabledAccentButton(accentButton)) {
        return;
      }

      playButtonClickSound();
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [soundEffectsEnabled]);
}
