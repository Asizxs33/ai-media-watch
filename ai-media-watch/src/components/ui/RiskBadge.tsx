import type { Category } from '../../types';

interface Props {
  score: number;
  category?: Category;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export function getRiskLevel(score: number): 'safe' | 'medium' | 'high' | 'critical' {
  if (score < 30) return 'safe';
  if (score < 60) return 'medium';
  if (score < 80) return 'high';
  return 'critical';
}

export function getRiskColor(score: number) {
  const level = getRiskLevel(score);
  if (level === 'safe') return { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30', bar: '#46e08a', glow: 'rgba(70,224,138,0.3)' };
  if (level === 'medium') return { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30', bar: '#ffb020', glow: 'rgba(255,176,32,0.3)' };
  if (level === 'high') return { bg: 'bg-danger/15', text: 'text-danger', border: 'border-danger/30', bar: '#ff5640', glow: 'rgba(255,86,64,0.4)' };
  return { bg: 'bg-accent-magenta/15', text: 'text-accent-magenta', border: 'border-accent-magenta/30', bar: '#ff3b6b', glow: 'rgba(255,59,107,0.5)' };
}

export function getCategoryLabel(category: Category) {
  const map: Record<Category, string> = {
    safe: '✅ Безопасно',
    casino: '🎰 Казино',
    pyramid: '💰 Пирамида',
    fraud: '⚠️ Мошенничество',
  };
  return map[category];
}

const sizeMap = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
};

export function RiskBadge({ score, category, size = 'md', showScore = true }: Props) {
  const colors = getRiskColor(score);
  const sizeClass = sizeMap[size];
  const level = getRiskLevel(score);

  let extraClasses = '';
  if (level === 'critical') extraClasses = 'neon-pulse-border strobe-pulse';
  else if (level === 'high') extraClasses = 'animate-[pulse_3s_ease-in-out_infinite]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold ${sizeClass} ${colors.bg} ${colors.text} ${colors.border} ${extraClasses}`}
      style={{ boxShadow: `0 0 10px ${colors.glow}, inset 0 0 5px ${colors.glow}` }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full shrink-0" 
        style={{ backgroundColor: colors.bar, boxShadow: `0 0 6px ${colors.bar}` }} 
      />
      {showScore && <span>{score}</span>}
      {showScore && <span className="opacity-60 font-normal">/100</span>}
      {category && !showScore && getCategoryLabel(category)}
    </span>
  );
}
