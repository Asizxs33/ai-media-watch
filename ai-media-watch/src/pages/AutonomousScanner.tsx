import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { getCategoryLabel } from '../components/ui/RiskBadge';
import { BACKEND } from '../config';

const sym = { fontVariationSettings: "'FILL' 0" };

interface ScannerStatus {
  running: boolean;
  paused: boolean;
  lastRunAt: string | null;
  lastRunDurationS: number | null;
  nextRunAt: string | null;
  totalScanned: number;
  totalFound: number;
  currentKeyword: string | null;
  lastError: string | null;
  recentFindings: Finding[];
  byPlatform: Record<string, number>;
  enabledPlatforms: string[];
}

interface Finding {
  id: string;
  platform: string;
  url: string;
  username: string;
  title: string;
  thumbnail?: string;
  isLive: boolean;
  keyword: string;
  riskScore: number;
  category: 'safe' | 'casino' | 'pyramid' | 'fraud';
  explanation: string;
  fraudTimestamps?: string[];
  detectedAt: string;
  source: string;
  requisites?: { type: string; value: string }[];
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeUntil(iso: string | null) {
  if (!iso) return '—';
  const diff = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  if (diff < 60) return `${diff}с`;
  return `${Math.floor(diff / 60)}м ${diff % 60}с`;
}

export default function AutonomousScanner() {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState('—');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    try {
      const r = await fetch(`${BACKEND}/api/scanner/status`);
      setStatus(await r.json());
    } catch {}
  }

  async function call(endpoint: string) {
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/scanner/${endpoint}`, { method: 'POST' });
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);
    countRef.current = setInterval(() => {
      setCountdown(() => {
        if (!status?.nextRunAt) return '—';
        return timeUntil(status.nextRunAt);
      });
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  // keep countdown reactive to status changes
  useEffect(() => {
    if (status?.nextRunAt) setCountdown(timeUntil(status.nextRunAt));
  }, [status?.nextRunAt]);

  const catColors: Record<string, string> = {
    casino:  'text-amber-400',
    pyramid: 'text-orange-400',
    fraud:   'text-red-400',
    safe:    'text-green-400',
  };

  const platformMeta: Record<string, { label: string; color: string; icon: string }> = {
    youtube: { label: 'YouTube', color: '#ff5640', icon: 'smart_display' },
    rutube:  { label: 'Rutube',  color: '#ff6b35', icon: 'play_circle'   },
  };

  return (
    <SidebarLayout>
      <div className="p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="material-symbols-outlined text-[28px] text-primary" style={sym}>robot_2</span>
              <h1 className="text-2xl font-bold text-on-surface">Автономный сканер</h1>
              {status?.running && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  СКАНИРУЕТ
                </span>
              )}
              {status?.paused && !status?.running && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  ОСТАНОВЛЕН
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">
              AI сам ищет все виды мошенничества в прямых эфирах и длинных видео — 24 ключевых слова
            </p>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Pause / Resume */}
            {!status?.paused ? (
              <button
                onClick={() => call('pause')}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface-variant text-sm font-semibold transition-all hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]" style={sym}>pause</span>
                Остановить
              </button>
            ) : (
              <button
                onClick={() => call('resume')}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container border border-emerald-400/30 text-emerald-400 text-sm font-semibold transition-all hover:bg-emerald-400/10 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]" style={sym}>play_arrow</span>
                Продолжить
              </button>
            )}

            {/* Trigger now */}
            <button
              onClick={() => call('trigger')}
              disabled={busy || status?.running}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold transition-opacity disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" style={sym}>
                {status?.running ? 'hourglass_top' : 'bolt'}
              </span>
              {status?.running ? 'Сканирует...' : 'Запустить сейчас'}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Проверено видео', value: status?.totalScanned ?? 0, icon: 'movie' },
            { label: 'Найдено угроз', value: status?.totalFound ?? 0, icon: 'warning', accent: true },
            { label: 'Последний запуск', value: fmt(status?.lastRunAt ?? null), icon: 'schedule' },
            { label: 'Следующий через', value: status?.running ? 'идёт...' : (status?.paused ? 'пауза' : countdown), icon: 'timer' },
          ].map((s) => (
            <div key={s.label} className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4">
              <span className={`material-symbols-outlined text-[20px] mb-2 block ${s.accent ? 'text-error' : 'text-on-surface-variant'}`} style={sym}>{s.icon}</span>
              <div className={`text-xl font-bold ${s.accent && (status?.totalFound ?? 0) > 0 ? 'text-error' : 'text-on-surface'}`}>{s.value}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Platform selection */}
        {status && (
          <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Платформы для сканирования</div>
              <div className="text-[10px] text-on-surface-variant">нажмите чтобы включить / выключить</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'youtube', label: 'YouTube', color: '#ff5640', icon: 'smart_display' },
                { id: 'tiktok',  label: 'TikTok',  color: '#ee1d51', icon: 'music_note'   },
                { id: 'rutube',  label: 'Rutube',  color: '#ff6b35', icon: 'play_circle'  },
              ].map(p => {
                const enabled = (status.enabledPlatforms ?? ['youtube', 'rutube']).includes(p.id);
                const count   = status.byPlatform?.[p.id] ?? 0;
                async function toggle() {
                  const current = status!.enabledPlatforms ?? ['youtube', 'rutube'];
                  const next = enabled
                    ? current.filter(x => x !== p.id)
                    : [...current, p.id];
                  if (next.length === 0) return;
                  await fetch(`${BACKEND}/api/scanner/platforms`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platforms: next }),
                  });
                  await fetchStatus();
                }
                return (
                  <button
                    key={p.id}
                    onClick={toggle}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl py-4 px-3 border-2 transition-all cursor-pointer ${
                      enabled
                        ? 'bg-surface-container-high border-transparent'
                        : 'bg-surface-container/40 border-outline-variant/20 opacity-40 grayscale'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[28px]" style={{ color: enabled ? p.color : undefined }}>{p.icon}</span>
                    <span className={`text-xs font-semibold ${enabled ? 'text-white' : 'text-on-surface-variant'}`}>{p.label}</span>
                    <span className={`text-xl font-bold ${count > 0 ? 'text-error' : 'text-on-surface-variant/50'}`}>{count}</span>
                    <span className="text-[10px] text-on-surface-variant">{enabled ? 'угроз найдено' : 'отключено'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current activity */}
        {status?.running && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-primary/8 border border-primary/20 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-on-surface">Анализирую ключевое слово</div>
              <div className="text-xs text-on-surface-variant font-mono mt-0.5">
                "{status.currentKeyword}"
              </div>
            </div>
          </motion.div>
        )}

        {/* Keywords — категории */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 mb-4">
          <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
            Что ищет — 24 ключевых слова по 8 схемам мошенничества
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { icon: 'casino',             label: 'Казино / Ставки',          color: 'amber',  tw: 'text-amber-400 bg-amber-400/8 border-amber-400/20',   keywords: ['казино прямой эфир', 'онлайн казино выигрыш', 'спортставки заработок', 'заработок прямой эфир live'] },
              { icon: 'account_tree',        label: 'Пирамиды / MLM',           color: 'orange', tw: 'text-orange-400 bg-orange-400/8 border-orange-400/20', keywords: ['пассивный доход инвестиции', 'MLM сетевой бизнес заработок', 'партнёрская программа прибыль', 'инвестиции прямой эфир'] },
              { icon: 'currency_exchange',   label: '"Закинь — получи"',         color: 'red',    tw: 'text-red-400 bg-red-400/8 border-red-400/20',          keywords: ['закинь получи прибыль', 'вложи удвою деньги', 'пришли деньги верну больше'] },
              { icon: 'show_chart',          label: 'Форекс / Трейдинг',        color: 'yellow', tw: 'text-yellow-400 bg-yellow-400/8 border-yellow-400/20', keywords: ['форекс сигналы заработок', 'трейдинг обучение прибыль', 'бинарные опционы заработок'] },
              { icon: 'currency_bitcoin',    label: 'Крипто мошенничество',     color: 'violet', tw: 'text-violet-400 bg-violet-400/8 border-violet-400/20', keywords: ['крипта быстрый заработок', 'bitcoin инвестиции гарантия', 'криптовалюта удвоение'] },
              { icon: 'work_off',            label: 'Фиктивная работа',         color: 'pink',   tw: 'text-pink-400 bg-pink-400/8 border-pink-400/20',       keywords: ['работа в интернете без вложений', 'удалённая работа заработок'] },
              { icon: 'credit_card',         label: 'Kaspi / Карты',            color: 'emerald',tw: 'text-emerald-400 bg-emerald-400/8 border-emerald-400/20', keywords: ['Kaspi перевод заработок', 'номер карты перевод выигрыш'] },
              { icon: 'redeem',              label: 'Фейковые розыгрыши',       color: 'cyan',   tw: 'text-cyan-400 bg-cyan-400/8 border-cyan-400/20',       keywords: ['розыгрыш приз победитель', 'выиграл получи деньги'] },
            ].map(({ icon, label, tw, keywords }) => (
              <div key={label} className={`rounded-xl border p-3 ${tw}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
                  <span className="ml-auto text-[10px] opacity-60">{keywords.length} кл.</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {keywords.map(kw => (
                    <span key={kw} className="text-[10px] font-mono bg-black/20 rounded px-1.5 py-0.5 text-white/80">{kw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 mb-6">
          <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Как работает</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {[
              { icon: 'search', title: 'Ищет сам', desc: 'Каждые 20 минут ищет прямые эфиры и новые видео по 6 ключевым словам про мошенничество в РК' },
              { icon: 'graphic_eq', title: 'Слушает эфиры', desc: '🔴 Live-потоки: скачивает 90 секунд аудио прямо сейчас → Whisper → Claude. Без пользователя.' },
              { icon: 'pin_drop', title: 'Находит момент', desc: 'В длинных видео указывает точный тайм-код: "Мошенничество на 4:23 и 7:45"' },
            ].map((s) => (
              <div key={s.title} className="flex gap-3">
                <span className="material-symbols-outlined text-[20px] text-primary flex-shrink-0 mt-0.5" style={sym}>{s.icon}</span>
                <div>
                  <div className="font-semibold text-on-surface">{s.title}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent findings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
              Последние находки
            </h2>
            <span className="text-xs text-on-surface-variant">
              {status?.recentFindings.length ?? 0} за сессию
            </span>
          </div>

          {!status?.recentFindings.length ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] mb-3 block opacity-30" style={sym}>radar</span>
              <div className="text-sm">
                {status?.running
                  ? 'Сканирование в процессе — результаты появятся здесь'
                  : 'Запусти сканирование чтобы начать'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {status.recentFindings.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 flex gap-4"
                  >
                    {/* Thumbnail */}
                    {f.thumbnail ? (
                      <img src={f.thumbnail} alt="" className="w-20 h-14 object-cover rounded-xl flex-shrink-0 bg-surface-container-high" />
                    ) : (
                      <div className="w-20 h-14 rounded-xl bg-surface-container-high flex-shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[24px] text-on-surface-variant" style={sym}>movie</span>
                      </div>
                    )}

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Platform badge */}
                          {platformMeta[f.platform] && (
                            <span
                              className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5"
                              style={{
                                color: platformMeta[f.platform].color,
                                background: platformMeta[f.platform].color + '18',
                                border: `1px solid ${platformMeta[f.platform].color}33`,
                              }}
                            >
                              <span className="material-symbols-outlined text-[11px]" style={sym}>{platformMeta[f.platform].icon}</span>
                              {platformMeta[f.platform].label}
                            </span>
                          )}
                          {f.isLive && (
                            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/25 rounded-full px-2 py-0.5">
                              ● LIVE
                            </span>
                          )}
                          <span className={`text-xs font-bold ${catColors[f.category] ?? 'text-on-surface-variant'}`}>
                            {getCategoryLabel(f.category)} · {f.riskScore}%
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant flex-shrink-0">{fmt(f.detectedAt)}</span>
                      </div>

                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-on-surface hover:text-primary transition-colors line-clamp-1 mt-1"
                      >
                        {f.title || f.url}
                      </a>

                      <div className="text-xs text-on-surface-variant mt-0.5">
                        @{f.username} · #{f.keyword}
                      </div>

                      {/* Fraud timestamps */}
                      {f.fraudTimestamps?.length ? (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <span className="text-xs text-on-surface-variant">Момент мошенничества:</span>
                          {f.fraudTimestamps.map(ts => (
                            <span key={ts} className="text-xs font-mono font-bold text-red-400 bg-red-400/10 border border-red-400/20 rounded px-1.5 py-0.5">
                              {ts}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Requisites */}
                      {f.requisites?.length ? (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {f.requisites.slice(0, 4).map((r, i) => (
                            <span key={i} className="text-xs font-mono text-amber-400 bg-amber-400/8 border border-amber-400/20 rounded px-1.5 py-0.5">
                              {r.type}: {r.value}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {f.explanation && (
                        <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-2">{f.explanation}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Error */}
        {status?.lastError && (
          <div className="mt-4 text-xs text-error bg-error/8 border border-error/20 rounded-xl p-3">
            <span className="font-bold">Ошибка последнего цикла:</span> {status.lastError}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
