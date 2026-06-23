import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { NetworkGraph } from '../components/NetworkGraph';
import { useAppStore } from '../store/useAppStore';
import type { RequisiteType } from '../types';

const sym = { fontVariationSettings: "'FILL' 0" };

const TYPE_META: Record<RequisiteType, { icon: string; label: string; color: string }> = {
  kaspi:    { icon: 'account_balance_wallet', label: 'Kaspi',    color: '#46e08a' },
  card:     { icon: 'credit_card',            label: 'Карта',    color: '#ffb020' },
  crypto:   { icon: 'currency_bitcoin',       label: 'Крипто',   color: '#8b6dff' },
  telegram: { icon: 'send',                   label: 'Telegram', color: '#ceff1a' },
  whatsapp: { icon: 'chat',                   label: 'WhatsApp', color: '#46e08a' },
  phone:    { icon: 'call',                   label: 'Телефон',  color: '#ffb020' },
  link:     { icon: 'link',                   label: 'Ссылка',   color: '#8b6dff' },
  promo:    { icon: 'sell',                   label: 'Промокод', color: '#ceff1a' },
  other:    { icon: 'help',                   label: 'Прочее',   color: '#9498a1' },
};

export default function Registry() {
  const posts = useAppStore((s) => s.posts);
  const buildRegistry = useAppStore((s) => s.requisitesRegistry);
  const registry = useMemo(() => buildRegistry(), [posts, buildRegistry]);
  const [view, setView] = useState<'list' | 'graph'>('list');

  const networks = registry.filter((r) => r.count > 1);
  const totalAccounts = new Set(registry.flatMap((r) => r.accounts)).size;

  const summary = [
    { label: 'Уникальных реквизитов', value: registry.length, color: 'text-primary' },
    { label: 'В нескольких схемах', value: networks.length, color: 'text-[#8b6dff]' },
    { label: 'Связанных аккаунтов', value: totalAccounts, color: 'text-error' },
  ];

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-6xl relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl" style={sym}>fingerprint</span>
            <h1 className="num-display text-4xl md:text-5xl text-on-surface">Реестр реквизитов</h1>
          </div>
          <p className="text-on-surface-variant text-sm max-w-2xl">
            Платёжные и контактные реквизиты, извлечённые Claude из проверенного контента.
            Один реквизит, встретившийся в нескольких схемах — признак единой сети мошенников.
          </p>
        </motion.div>

        {/* View toggle */}
        <div className="inline-flex gap-1 p-1 rounded-xl bg-surface-container-low border border-white/[0.06] mb-6">
          {([['list', 'list', 'Список'], ['graph', 'hub', 'Граф связей']] as const).map(([v, icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                view === v ? 'bg-primary text-on-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base" style={sym}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          {summary.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bento bento-lift min-h-[120px] flex flex-col justify-between"
            >
              <span className="font-code-sm text-[10px] uppercase tracking-widest text-on-surface-variant">{s.label}</span>
              <div className={`num-display text-4xl md:text-5xl ${s.color}`}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {view === 'graph' ? (
          <NetworkGraph posts={posts} />
        ) : registry.length === 0 ? (
          <div className="bento p-16 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block" style={sym}>fingerprint</span>
            <p className="text-on-surface-variant font-code-sm text-code-sm mb-2">Реестр пуст</p>
            <p className="text-on-surface-variant/50 text-xs">
              Проанализируй посты в разделах <Link to="/scanner" className="text-primary hover:underline">Анализ</Link> или{' '}
              <Link to="/livescanner" className="text-primary hover:underline">Live Сканер</Link> — реквизиты соберутся автоматически
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {registry.map((r, i) => {
              const meta = TYPE_META[r.type] ?? TYPE_META.other;
              const isNetwork = r.count > 1;
              return (
                <motion.div
                  key={`${r.type}:${r.value}`}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="bento bento-lift flex flex-wrap items-center gap-4"
                  style={isNetwork ? { borderColor: 'rgba(139,109,255,0.45)', boxShadow: '0 0 0 1px rgba(139,109,255,0.2)' } : undefined}
                >
                  {/* Type icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}40` }}
                  >
                    <span className="material-symbols-outlined" style={{ ...sym, color: meta.color }}>{meta.icon}</span>
                  </div>

                  {/* Value + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-code-sm text-sm text-on-surface break-all">{r.value}</span>
                      <span
                        className="font-code-sm text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0"
                        style={{ background: `${meta.color}1a`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {isNetwork && (
                        <span className="font-code-sm text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#8b6dff]/15 text-[#b9a6ff] flex items-center gap-1 shrink-0">
                          <span className="material-symbols-outlined text-xs" style={sym}>hub</span>
                          сеть ×{r.count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {r.accounts.slice(0, 4).map((a) => (
                        <span key={a} className="text-xs text-on-surface-variant">@{a}</span>
                      ))}
                      {r.accounts.length > 4 && (
                        <span className="text-xs text-on-surface-variant/50">+{r.accounts.length - 4}</span>
                      )}
                      <span className="text-on-surface-variant/30">·</span>
                      <span className="text-xs text-on-surface-variant/60 font-code-sm uppercase">
                        {r.platforms.join(' · ')}
                      </span>
                    </div>
                  </div>

                  {/* Count + risk */}
                  <div className="flex items-center gap-5 shrink-0 ml-auto">
                    <div className="text-right">
                      <div className="num-display text-2xl text-on-surface">{r.count}</div>
                      <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">постов</div>
                    </div>
                    <div className="text-right">
                      <div className={`num-display text-2xl ${r.maxRisk >= 70 ? 'text-error' : r.maxRisk >= 40 ? 'text-warning' : 'text-tertiary'}`}>
                        {r.maxRisk}
                      </div>
                      <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">риск</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
