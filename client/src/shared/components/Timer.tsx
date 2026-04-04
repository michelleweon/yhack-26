import { motion } from 'framer-motion';
import { useTickingAudio } from '@/shared/hooks/useTickingAudio';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  size?: number;
}

export function Timer({ timeRemaining, totalTime, size = 140 }: TimerProps) {
  const safeTotalTime = totalTime > 0 ? totalTime : 1;
  const center = size / 2;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, timeRemaining / safeTotalTime));
  const offset = circumference * (1 - progress);
  const isUrgent = timeRemaining <= 5;

  useTickingAudio({
    enabled: timeRemaining > 0,
    timeRemaining,
    totalTime: safeTotalTime,
  });

  const tickMarks = Array.from({ length: 60 }, (_, i) => {
    const angle = ((i * 6 - 90) * Math.PI) / 180;
    const isMajor = i % 5 === 0;
    const outerR = radius + 6;
    const innerR = isMajor ? radius - 4 : radius - 1;
    return { x1: center + outerR * Math.cos(angle), y1: center + outerR * Math.sin(angle), x2: center + innerR * Math.cos(angle), y2: center + innerR * Math.sin(angle), isMajor };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={radius + 8} fill="#1a202c" stroke="#2d3748" strokeWidth={3} />
        <circle cx={center} cy={center} r={radius + 2} fill="none" stroke="#2d3748" strokeWidth={1} />
        {tickMarks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.isMajor ? '#a0aec0' : '#4a5568'} strokeWidth={t.isMajor ? 2 : 1} />
        ))}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#2d3748" strokeWidth={8} />
        <motion.circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={isUrgent ? '#e53e3e' : '#d69e2e'}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'linear' }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
        <circle cx={center} cy={center} r={radius - 12} fill="#0d1117" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="font-title select-none"
          style={{ fontSize: size * 0.32, color: isUrgent ? '#e53e3e' : '#ffffff' }}
          animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
          transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
        >
          {Math.ceil(timeRemaining)}
        </motion.span>
      </div>
    </div>
  );
}
