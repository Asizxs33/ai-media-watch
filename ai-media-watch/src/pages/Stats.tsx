import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, XAxis, YAxis } from 'recharts';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { useAppStore } from '../store/useAppStore';

const sym = { fontVariationSettings: "'FILL' 0" };

const RADIAN = Math.PI / 180;
const renderLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (!percent || percent < 0.06) return null;
  const radius = (innerRadius || 0) + ((outerRadius || 0) - (innerRadius || 0)) * 0.5;
  const x = (cx || 0) + radius * Math.cos(-(midAngle || 0) * RADIAN);
  const y = (cy || 0) + radius * Math.sin(-(midAngle || 0) * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {Math.round(percent * 100)}%
    </text>
  );
};

export default function Stats() {
  const posts = useAppStore((s) => s.posts);

  const total      = posts.length;
  const violations = posts.filter(p => p.category !== 'safe').length;
  const blocked    = posts.filter(p => p.status === 'blocked').length;
  const avgRisk    = total > 0 ? Math.round(posts.reduce((s, p) => s + p.riskScore, 0) / total) : 0;

  const statCards = [
    { icon: 'search',   label: 'Всего проверено',    value: total.toString(),      color: 'text-primary' },
    { icon: 'warning',  label: 'Найдено нарушений',  value: violations.toString(), color: 'text-warning' },
    { icon: 'block',    label: 'Заблокировано',       value: blocked.toString(),    color: 'text-error' },
    { icon: 'speed',    label: 'Средний Risk Score',  value: total > 0 ? String(avgRisk) : '—', color: 'text-tertiary' },
  ];

  const catData = [
    { name: 'Безопасно',     value: posts.filter(p => p.category === 'safe').length,    color: '#46e08a' },
    { name: 'Казино',        value: posts.filter(p => p.category === 'casino').length,   color: '#ffb020' },
    { name: 'Пирамида',      value: posts.filter(p => p.category === 'pyramid').length,  color: '#ff3b6b' },
    { name: 'Мошенничество', value: posts.filter(p => p.category === 'fraud').length,    color: '#ff5640' },
  ].filter(d => d.value > 0);

  const platformData = (['tiktok', 'instagram', 'youtube'] as const).map(pl => {
    const pl_posts = posts.filter(p => p.platform === pl);
    return {
      name: pl === 'tiktok' ? 'TikTok' : pl === 'instagram' ? 'Instagram' : 'YouTube',
      safe:       pl_posts.filter(p => p.category === 'safe').length,
      suspicious: pl_posts.filter(p => p.category !== 'safe' && p.riskScore < 70).length,
      fraud:      pl_posts.filter(p => p.riskScore >= 70).length,
    };
  }).filter(d => d.safe + d.suspicious + d.fraud > 0);

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="num-display text-4xl md:text-5xl text-on-surface mb-2">Статистика</h1>
          <p className="text-on-surface-variant text-sm">
            {total > 0 ? `На основе ${total} реальных анализов` : 'Нет данных — проанализируй первый пост в разделе Сканер'}
          </p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {statCards.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <div className="bento bento-lift min-h-[140px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-code-sm text-[10px] uppercase tracking-widest text-on-surface-variant">{s.label}</span>
                  <span className="material-symbols-outlined text-lg text-on-surface-variant/50" style={sym}>{s.icon}</span>
                </div>
                <div className={`num-display text-4xl md:text-5xl ${s.color}`}>{s.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {total === 0 ? (
          <div className="glass-card p-16 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block" style={sym}>bar_chart</span>
            <p className="text-on-surface-variant font-code-sm text-code-sm">
              Статистика появится после первого реального анализа
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {/* Pie */}
            {catData.length > 0 && (
              <div className="glass-card p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500 opacity-5 blur-[60px] pointer-events-none" />
                <h3 className="font-headline-md text-base font-semibold text-on-surface mb-4 relative z-10">Распределение по категориям</h3>
                <ResponsiveContainer width="100%" height={220} className="relative z-10 drop-shadow-xl">
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" labelLine={false} label={renderLabel} stroke="rgba(0,0,0,0.2)" strokeWidth={2}>
                      {catData.map((entry, i) => <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0 0 8px ${entry.color}40)` }} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'rgba(19, 24, 38, 0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {catData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Platform bar */}
            {platformData.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="font-headline-md text-base font-semibold text-on-surface mb-4">По платформам</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={platformData} barSize={32}>
                    <XAxis dataKey="name" tick={{ fill: '#9498a1', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: '#17181c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} formatter={(v) => <span style={{ color: '#9498a1' }}>{v}</span>} />
                    <Bar dataKey="safe"       name="Безопасно" stackId="a" fill="#46e08a" />
                    <Bar dataKey="suspicious" name="Подозрит." stackId="a" fill="#ffb020" />
                    <Bar dataKey="fraud"      name="Угроза"    stackId="a" fill="#ff5640" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
