import { useState, useEffect } from 'react';
import { FileText, Trophy, TrendingUp } from 'lucide-react';

function AnimatedNumber({ target, duration = 1500, prefix = '', suffix = '' }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return <span>{prefix}{current.toLocaleString('fr-BE')}{suffix}</span>;
}

export default function StatsHeader({ tenderCount, winnerCount, totalVolume }) {
  const stats = [
    {
      icon: FileText,
      label: 'Appels d\'offres actifs',
      value: tenderCount,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Trophy,
      label: 'Attributions récentes',
      value: winnerCount,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      icon: TrendingUp,
      label: 'Volume total',
      value: totalVolume,
      isVolume: true,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`animate-count-up bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow`}
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`${stat.bg} ${stat.color} p-2.5 rounded-xl`}>
              <stat.icon size={22} />
            </div>
            <span className="text-sm font-medium text-gray-500">{stat.label}</span>
          </div>
          <div className={`text-3xl font-bold ${stat.color}`}>
            {stat.isVolume ? (
              <AnimatedNumber target={stat.value} prefix="" suffix=" €" />
            ) : (
              <AnimatedNumber target={stat.value} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
