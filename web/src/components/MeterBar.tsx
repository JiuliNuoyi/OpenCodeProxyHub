interface MeterBarProps {
  label: string;
  current: number;
  max: number;
  /** When max is 0/unlimited, show this text instead of a ratio. */
  unlimitedText?: string;
}

export function MeterBar({ label, current, max, unlimitedText = "不限" }: MeterBarProps) {
  const unlimited = !max || max <= 0;
  const ratio = unlimited ? 0 : Math.min(1, current / max);
  const tone = ratio >= 0.9 ? "progress-error" : ratio >= 0.7 ? "progress-warning" : "progress-success";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-base-content/50">{label}</span>
        <span className="font-medium tabular-nums">
          {current}
          {unlimited ? ` / ${unlimitedText}` : ` / ${max}`}
        </span>
      </div>
      <progress className={`progress ${unlimited ? "progress-info" : tone} h-2 w-full`} value={unlimited ? 0 : Math.round(ratio * 100)} max={100} />
    </div>
  );
}
