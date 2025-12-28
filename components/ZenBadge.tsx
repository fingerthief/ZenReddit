
import React from 'react';
import { Leaf, Wind, AlertCircle } from 'lucide-react';

interface ZenBadgeProps {
  score: number;
  size?: 'sm' | 'md';
  className?: string;
}

const ZenBadge: React.FC<ZenBadgeProps> = ({ score, size = 'sm', className = '' }) => {
  let colorClass = '';
  let Icon = Leaf;

  // Determine styling based on score thresholds
  if (score >= 80) {
    colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    Icon = Leaf;
  } else if (score >= 50) {
    colorClass = 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800';
    Icon = Wind;
  } else {
    colorClass = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    Icon = AlertCircle;
  }

  const iconSize = size === 'sm' ? 10 : 13;

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap shadow-sm select-none
        ${colorClass} 
        ${size === 'sm' ? 'text-[9px] px-2 py-0.5 h-5' : 'text-[10px] px-2.5 py-1 h-6'}
        ${className}
      `}
      title={`Zen Score: ${score}/100`}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
      <span>{score}</span>
    </div>
  );
};

export default ZenBadge;
