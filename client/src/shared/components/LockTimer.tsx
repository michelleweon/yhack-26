import { useEffect, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import lockDialImage from '@/assets/ui/lock-dial.png';
import { useTickingAudio } from '@/shared/hooks/useTickingAudio';

interface LockTimerProps {
  totalTime: number;
  timeRemaining?: number;
  deadlineAt?: string | null;
  size?: number;
}

const RING_INSET = '7%';
const CORE_INSET = '18%';
const DIAL_SCALE = 0.765;
const DIGIT_SCALE = 0.9;
const DIGIT_WIDTH_RATIO = 0.28;
const DIGIT_FONT_RATIO = 0.19584;
const URGENT_TRANSITION = { duration: 0.8, repeat: Infinity, ease: 'easeInOut' as const };

const DIAL_RING_MASK: CSSProperties = {
  WebkitMaskImage:
    'radial-gradient(circle, transparent 0 26%, #000 27%, #000 51%, transparent 52%)',
  maskImage:
    'radial-gradient(circle, transparent 0 26%, #000 27%, #000 51%, transparent 52%)',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function LockDialFace() {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-full bg-center bg-cover"
      style={{
        backgroundImage: `url(${lockDialImage})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        transform: `scale(${DIAL_SCALE})`,
        transformOrigin: 'center',
        filter: 'brightness(0.68) contrast(1.08) saturate(0.82)',
      }}
    />
  );
}

interface LockProgressRingProps {
  fillDegrees: number;
  fillRatio: number;
}

function LockProgressRing({ fillDegrees, fillRatio }: LockProgressRingProps) {
  const ringVisible = fillRatio > 0;

  return (
    <>
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          ...DIAL_RING_MASK,
          inset: RING_INSET,
          background: `conic-gradient(
            from 0deg,
            rgba(127, 29, 29, 0) 0deg,
            rgba(148, 34, 34, 0.32) 22deg,
            rgba(127, 29, 29, 0) 44deg,
            rgba(127, 29, 29, 0) 360deg
          )`,
          opacity: ringVisible ? 0.4 : 0,
          mixBlendMode: 'screen',
          filter: 'blur(0.5px)',
        }}
      />

      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          ...DIAL_RING_MASK,
          inset: RING_INSET,
          background: `conic-gradient(
            from 0deg,
            rgba(148, 34, 34, 0.95) 0deg,
            rgba(148, 34, 34, 0.95) ${fillDegrees}deg,
            transparent ${fillDegrees}deg,
            transparent 360deg
          )`,
          mixBlendMode: 'multiply',
          opacity: ringVisible ? 0.95 : 0,
          boxShadow: '0 0 10px rgba(148, 34, 34, 0.28)',
        }}
      />

      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          ...DIAL_RING_MASK,
          inset: RING_INSET,
          background: `conic-gradient(
            from 90deg,
            rgba(255, 120, 120, 0.08) 0deg,
            rgba(176, 32, 32, 0.36) 72deg,
            rgba(70, 0, 0, 0.18) 140deg,
            rgba(176, 32, 32, 0.36) 250deg,
            rgba(255, 120, 120, 0.08) 360deg
          )`,
          opacity: ringVisible ? 0.95 : 0,
          mixBlendMode: 'screen',
          filter: 'blur(1px)',
        }}
      />
    </>
  );
}

function LockPulseCore({ isUrgent }: { isUrgent: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        inset: CORE_INSET,
        boxShadow: isUrgent
          ? '0 0 24px rgba(127, 29, 29, 0.35), inset 0 0 14px rgba(127, 29, 29, 0.28)'
          : '0 0 14px rgba(69, 10, 10, 0.18), inset 0 0 10px rgba(69, 10, 10, 0.16)',
      }}
      animate={isUrgent ? { scale: [1, 1.03, 1] } : undefined}
      transition={isUrgent ? URGENT_TRANSITION : undefined}
    />
  );
}

interface LockCountdownDigitsProps {
  timeRemaining: number;
  size: number;
  isUrgent: boolean;
}

function LockCountdownDigits({
  timeRemaining,
  size,
  isUrgent,
}: LockCountdownDigitsProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.span
        className="inline-flex items-center justify-center leading-none tabular-nums"
        style={{
          width: size * DIGIT_WIDTH_RATIO * DIGIT_SCALE,
          fontFamily:
            '"Eurostile Bold Extended", "Eurostile Bold", "Microgramma D Extended", "Bank Gothic", "Arial Black", sans-serif',
          fontSize: size * DIGIT_FONT_RATIO * DIGIT_SCALE,
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: '#cfcfcf',
          WebkitTextStroke: '1px #2a2a2a',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.45)',
          transform: 'scale(1.02) scaleX(0.92)',
          filter: 'brightness(0.68) contrast(1.08) saturate(0.82)',
        }}
        animate={isUrgent ? { opacity: [0.85, 1, 0.85] } : undefined}
        transition={isUrgent ? URGENT_TRANSITION : undefined}
      >
        {Math.ceil(timeRemaining)}
      </motion.span>
    </div>
  );
}

export function LockTimer({
  timeRemaining,
  totalTime,
  deadlineAt,
  size = 140,
}: LockTimerProps) {
  const [derivedTimeRemaining, setDerivedTimeRemaining] = useState(() => (
    deadlineAt ? getTimeRemaining(deadlineAt) : Math.ceil(timeRemaining ?? totalTime)
  ));

  useEffect(() => {
    if (!deadlineAt) {
      setDerivedTimeRemaining(Math.ceil(timeRemaining ?? totalTime));
      return;
    }

    const syncTime = () => {
      setDerivedTimeRemaining(getTimeRemaining(deadlineAt));
    };

    syncTime();
    const intervalId = window.setInterval(syncTime, 1000);

    return () => window.clearInterval(intervalId);
  }, [deadlineAt, timeRemaining, totalTime]);

  const displayTimeRemaining = deadlineAt
    ? derivedTimeRemaining
    : Math.ceil(timeRemaining ?? totalTime);
  const safeTotalTime = totalTime > 0 ? totalTime : 1;
  const remainingRatio = clamp(displayTimeRemaining / safeTotalTime, 0, 1);
  const fillRatio = 1 - remainingRatio;
  const fillDegrees = fillRatio * 360;
  const isUrgent = displayTimeRemaining <= 5;

  useTickingAudio({
    enabled: displayTimeRemaining > 0,
    timeRemaining: displayTimeRemaining,
    totalTime: safeTotalTime,
    deadlineAt,
  });

  return (
    <div
      className="relative inline-flex isolate select-none items-center justify-center"
      style={{ width: size, height: size }}
    >
      <LockDialFace />
      <LockProgressRing fillDegrees={fillDegrees} fillRatio={fillRatio} />
      <LockPulseCore isUrgent={isUrgent} />
      <LockCountdownDigits timeRemaining={displayTimeRemaining} size={size} isUrgent={isUrgent} />
    </div>
  );
}

function getTimeRemaining(deadlineAt: string): number {
  const deadlineMs = new Date(deadlineAt).getTime();
  const diffMs = deadlineMs - Date.now();

  return Math.max(0, Math.ceil(diffMs / 1000));
}
