import { motion } from 'framer-motion';
import { getAnswerMeta } from '@/constants/gameConfig';

interface AnswerButtonProps {
  index: number;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export function AnswerButton({ index, label, onSelect, disabled = false, selected = false }: AnswerButtonProps) {
  const color = getAnswerMeta(index);

  return (
    <motion.button
      type="button"
      data-button-click-sound="accent"
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className="flex w-full items-center gap-3 rounded-[1.35rem] border border-white/10 bg-black/18 px-4 py-4 text-left text-white transition-[transform,border-color,background-color,opacity] active:opacity-90 disabled:cursor-not-allowed"
      style={{
        borderColor: selected ? 'rgba(214, 158, 46, 0.82)' : 'rgba(255,255,255,0.1)',
        opacity: disabled && !selected ? 0.5 : 1,
        backgroundColor: selected ? 'rgba(214, 158, 46, 0.12)' : 'rgba(0, 0, 0, 0.18)',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-title text-[1.65rem] leading-none text-white"
        style={{ backgroundColor: color.bg }}
      >
        {color.label}
      </span>
      <span className="font-ui text-[1.05rem] font-semibold leading-tight text-white">
        {label}
      </span>
    </motion.button>
  );
}
