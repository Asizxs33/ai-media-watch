import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { getRiskColor, getCategoryLabel } from '../components/ui/RiskBadge';
import { BACKEND } from '../config';

const sym = { fontVariationSettings: "'FILL' 0" };

interface ScannerStatus {
  running: boolean;
  lastRunAt: string | null;
  lastRunDurationS: number | null;
  nextRunAt: string | null;
  totalScanned: number;
  totalFound: number;
  currentKeyword: string | null;
  lastError: string | null;
  recentFindings: Finding[];
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
  const [triggering, setTriggering] = useState(false);
  const [countdown, setCountdown] = useState('—');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    try {
      const r = await fetch(`${BACKEND}/api/scanner/status`);
      const d = await r.json();
      setStatus(d);
    } catch {}
  }

  async function triggerScan() {
    setTriggering(true);
    try {
      await fetch(`${BACKEND}/api/scanner/trigger`, { method: 'POST' });
      await fetchStatus();
    } finally {
      setTriggering(false);
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

  return (
    <SidebarLayout>
      <div className="p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[28px] text-primary" style={sym}>robot_2</span>
              <h1 className="text-2xl font-bold text-on-surface">Автономный сканер</h1>
              {status?.running && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  СКАНИРУЕТ
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">
              AI сам ищет прямые эфиры и длинные видео с мошенничеством — без участия пользователя
            </p>
          </div>
          <button
            onClick={triggerScan}
            disabled={triggering || status?.running}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" style={sym}>
              {status?.running ? 'hourglass_top' : 'play_arrow'}
            </span>
            {status?.running ? 'Идёт сканирование...' : 'Запустить сейчас'}
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Проверено видео', value: status?.totalScanned ?? 0, icon: 'movie' },
            { label: 'Найдено угроз', value: status?.totalFound ?? 0, icon: 'warning', accent: true },
            { label: 'Последний запуск', value: fmt(status?.lastRunAt ?? null), icon: 'schedule' },
            { label: 'Следующий через', value: status?.running ? 'идёт...' : countdown, icon: 'timer' },
          ].map((s) => (
            <div key={s.label} className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4">
              <span className={`material-symbols-outlined text-[20px] mb-2 block ${s.accent ? 'text-error' : 'text-on-surface-variant'}`} style={sym}>{s.icon}</span>
              <div className={`text-xl font-bold ${s.accent && (status?.totalFound ?? 0) > 0 ? 'text-error' : 'text-on-surface'}`}>{s.value}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

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
