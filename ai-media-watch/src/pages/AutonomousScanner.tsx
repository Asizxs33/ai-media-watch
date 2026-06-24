import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { getRiskColor, getCategoryLabel } from '../components/ui/RiskBadge';
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
      setCountdown(prev => {
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
    youtube: { label: 'YouTube',   color: '#ff5640', icon: 'smart_display'  },
    tiktok:  { label: 'TikTok',    color: '#9aa0a6', icon: 'videocam'       },
    vk:      { label: 'ВКонтакте', color: '#4c75a3', icon: 'group'          },
    rutube:  { label: 'Rutube',    color: '#ff6b35', icon: 'play_circle'    },
    ok:      { label: 'OK.ru',     color: '#f5a623', icon: 'star'           },
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

        {/* Platform breakdown */}
        {status && (
          <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 mb-4">
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Найдено по платформам</div>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'youtube', label: 'YouTube',   color: '#ff5640' },
                { id: 'tiktok',  label: 'TikTok',    color: '#9aa0a6' },
                { id: 'vk',      label: 'ВКонтакте', color: '#4c75a3' },
                { id: 'rutube',  label: 'Rutube',    color: '#ff6b35' },
                { id: 'ok',      label: 'OK.ru',     color: '#f5a623' },
              ].map(p => {
                const count = status.byPlatform?.[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-surface-container-high rounded-xl px-3 py-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-xs text-on-surface-variant">{p.label}</span>
                    <span className={`text-sm font-bold ml-1 ${count > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{count}</span>
                  </div>
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

        {/* Keywords — что именно ищет */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 mb-4">
          <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
            Что ищет — 24 ключевых слова по всем схемам мошенничества
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'казино прямой эфир',            cat: 'casino' },
              { label: 'онлайн казино выигрыш',         cat: 'casino' },
              { label: 'спортставки заработок',          cat: 'casino' },
              { label: 'пассивный доход инвестиции',     cat: 'pyramid' },
              { label: 'MLM сетевой бизнес',            cat: 'pyramid' },
              { label: 'партнёрская программа прибыль',  cat: 'pyramid' },
              { label: 'закинь получи прибыль',          cat: 'fraud' },
              { label: 'вложи удвою деньги',             cat: 'fraud' },
              { label: 'пришли деньги верну больше',     cat: 'fraud' },
              { label: 'форекс сигналы заработок',       cat: 'pyramid' },
              { label: 'трейдинг обучение прибыль',      cat: 'pyramid' },
              { label: 'бинарные опционы',               cat: 'pyramid' },
              { label: 'крипта быстрый заработок',       cat: 'fraud' },
              { label: 'bitcoin инвестиции гарантия',    cat: 'fraud' },
              { label: 'криптовалюта удвоение',          cat: 'fraud' },
              { label: 'работа в интернете без вложений',cat: 'fraud' },
              { label: 'удалённая работа заработок',     cat: 'fraud' },
              { label: 'Kaspi перевод заработок',        cat: 'fraud' },
              { label: 'номер карты перевод выигрыш',   cat: 'fraud' },
              { label: 'розыгрыш приз победитель',       cat: 'fraud' },
              { label: 'выиграл получи деньги',          cat: 'fraud' },
              { label: 'заработок прямой эфир live',     cat: 'casino' },
              { label: 'инвестиции прямой эфир',         cat: 'pyramid' },
            ].map(({ label, cat }) => (
              <span
                key={label}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border ${
                  cat === 'casino'  ? 'text-amber-400  bg-amber-400/8  border-amber-400/20'  :
                  cat === 'pyramid' ? 'text-orange-400 bg-orange-400/8 border-orange-400/20' :
                                     'text-red-400    bg-red-400/8    border-red-400/20'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-400/40 inline-block" /> казино/ставки</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-orange-400/40 inline-block" /> пирамиды/MLM</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-400/40 inline-block" /> мошенничество</span>
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
