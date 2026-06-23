import { motion } from 'framer-motion';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { useAppStore } from '../store/useAppStore';
import { getCategoryLabel, getRiskColor } from '../components/ui/RiskBadge';

const sym = { fontVariationSettings: "'FILL' 0" };

const catColors: Record<string, { stroke: string }> = {
  casino:  { stroke: '#ffb020' },
  pyramid: { stroke: '#ff3b6b' },
  fraud:   { stroke: '#ff5640' },
  safe:    { stroke: '#46e08a' },
};

export default function Trends() {
  const posts = useAppStore((s) => s.posts);

  // Собираем реальные маркеры из всех проверенных постов
  const markerMap: Record<string, { count: number; categories: string[]; riskScores: number[] }> = {};
  for (const post of posts) {
    for (const marker of post.detectedMarkers) {
      if (!markerMap[marker]) markerMap[marker] = { count: 0, categories: [], riskScores: [] };
      markerMap[marker].count++;
      markerMap[marker].categories.push(post.category);
      markerMap[marker].riskScores.push(post.riskScore);
    }
  }

  const topMarkers = Object.entries(markerMap)
    .map(([marker, data]) => ({
      marker,
      count: data.count,
      avgRisk: Math.round(data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length),
      topCategory: data.categories.sort((a, b) =>
        data.categories.filter(x => x === b).length - data.categories.filter(x => x === a).length
      )[0],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Последние анализы по датам
  const byDay: Record<string, { safe: number; violations: number }> = {};
  for (const post of posts) {
    const day = new Date(post.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    if (!byDay[day]) byDay[day] = { safe: 0, violations: 0 };
    if (post.category === 'safe') byDay[day].safe++;
    else byDay[day].violations++;
  }

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl" style={sym}>ssid_chart</span>
            <h1 className="num-display text-4xl md:text-5xl text-on-surface">Радар угроз</h1>
          </div>
          <p className="text-on-surface-variant text-sm">
            {posts.length > 0
              ? `Паттерны из ${posts.length} реальных анализов`
              : 'Данные появятся после анализа постов в разделе Сканер'}
          </p>
        </motion.div>

        {posts.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block" style={sym}>ssid_chart</span>
            <p className="text-on-surface-variant font-code-sm text-code-sm mb-2">Нет данных для анализа трендов</p>
            <p className="text-on-surface-variant/50 text-xs">Проанализируй посты в разделе Сканер — тренды будут строиться автоматически</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top markers */}
            {topMarkers.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-4">ТОП МАРКЕРЫ МОШЕННИЧЕСТВА</h3>
                <div className="space-y-3">
                  {topMarkers.map((item, i) => {
                    const colors = getRiskColor(item.avgRisk);
                    const catColor = catColors[item.topCategory]?.stroke ?? '#e4bdc3';
                    return (
                      <motion.div
                        key={item.marker}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-4 group hover:bg-white/[0.02] p-2 -mx-2 rounded-lg transition-colors cursor-default relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-out pointer-events-none" />
                        <span className="font-code-sm text-code-sm text-on-surface-variant/40 w-6 text-right shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-on-surface font-medium truncate">{item.marker}</span>
                            <span
                              className="font-label-caps text-label-caps text-xs px-2 py-0.5 rounded-full border shrink-0"
                              style={{ color: catColor, borderColor: `${catColor}40`, background: `${catColor}10` }}
                            >
                              {getCategoryLabel(item.topCategory as any)}
                            </span>
                          </div>
                          <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${(item.count / (topMarkers[0]?.count || 1)) * 100}%`,
                                backgroundColor: colors.bar,
                              }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`font-code-sm text-sm font-bold ${colors.text}`}>
                            {item.count}×
                          </div>
                          <div className="text-xs text-on-surface-variant/50">Risk {item.avgRisk}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent by day */}
            {Object.keys(byDay).length > 0 && (
              <div className="glass-card p-5">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-4">АНАЛИЗЫ ПО ДНЯМ</h3>
                <div className="space-y-2">
                  {Object.entries(byDay).reverse().map(([day, counts]) => (
                    <div key={day} className="flex items-center gap-3 group hover:bg-white/[0.02] p-2 -mx-2 rounded-lg transition-colors">
                      <span className="font-code-sm text-code-sm text-on-surface-variant/60 w-20 shrink-0 group-hover:text-secondary-container transition-colors">{day}</span>
                      <div className="flex gap-2 flex-1">
                        {counts.safe > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 font-code-sm">
                            ✓ {counts.safe} безопасно
                          </span>
                        )}
                        {counts.violations > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-error-container/20 text-error border border-error/20 font-code-sm">
                            ⚠ {counts.violations} нарушений
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
