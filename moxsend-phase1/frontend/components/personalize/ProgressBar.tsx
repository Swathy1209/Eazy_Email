'use client';

type ProgressBarProps = {
  value: number;
  className?: string;
  fillClassName?: string;
};

export function ProgressBar({ value, className = '', fillClassName = 'progress-fill-cyan' }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress-track ${className}`}>
      <div className={`progress-fill ${fillClassName}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}
