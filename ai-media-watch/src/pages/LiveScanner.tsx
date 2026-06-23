import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { getRiskColor, getCategoryLabel } from '../components/ui/RiskBadge';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { composeAnalystComment } from '../utils/analyst';
import { detectRegion } from '../utils/region';
import { BACKEND } from '../config';
import type { Post, Platform } from '../types';

const sym = { fontVariationSettings: "'FILL' 0" };

const PRESET_QUERIES = [
  { label: 'Казино', keywords: 'казино онлайн,слоты,ставки' },
  { label: 'Пирамиды', keywords: 'заработок без вложений,пассивный доход,MLM' },
  { label: 'Мошенники', keywords: 'выиграй приз,пришли деньги получи больше,форекс сигналы' },
  { label: 'Крипто', keywords: 'крипто заработок,bitcoin easy money,инвестиции гарантия' },
];

type ScanState = 'idle' | 'scanning' | 'done';

interface LiveCard {
  id: string;
  url: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  username: string;
  title: string;
  thumbnail: string;
  viewCount: number;
  keyword: string;
  state: 'analyzing' | 'done';
  // classification (after done)
  category?: 'safe' | 'casino' | 'pyramid' | 'fraud';
  riskScore?: number;
  confidence?: number;
  detectedMarkers?: string[];
  explanation?: string;
  legalReference?: string;
}

const platformIcon: Record<string, string> = {
  youtube: 'smart_display',
  tiktok: 'videocam',
  instagram: 'photo_camera',
};

const platformColor: Record<string, string> = {
  youtube: '#ff5640',
  tiktok: '#9aa0a6',
  instagram: '#ff3b6b',
};

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/* Печатает текст по буквам (объяснение Claude) */
function Typewriter({ text, speed = 16 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="text-primary animate-pulse">▋</span>}
    </>
  );
}

export default function LiveScanner() {
  const addPost = useAppStore((s) => s.addPost);
  const pushAnalyst = useAppStore((s) => s.pushAnalyst);

  const [keywords, setKeywords]     = useState('казино онлайн,заработок без вложений');
  const [platforms, setPlatforms]   = useState<Set<string>>(new Set(['youtube']));
  const [limit, setLimit]           = useState(15);
  const [scanState, setScanState]   = useState<ScanState>('idle');
  const [cards, setCards]           = useState<LiveCard[]>([]);
  const [stats, setStats]           = useState({ scanned: 0, found: 0, threats: 0 });
  const [statusMsg, setStatusMsg]   = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanIdRef = useRef<string | null>(null);

  const togglePlatform = (p: string) => {
    setPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) { if (next.size > 1) next.delete(p); }
      else next.add(p);
      return next;
    });
  };

  // Обработка одного события (общая для poll); тип в ev.type
  const applyEvent = useCallback((d: any) => {
    if (d.type === 'status') {
      setStatusMsg(d.message);
      return;
    }
    if (d.type === 'found') {
      setCards(prev => {
        // Один и тот же ролик может найтись по нескольким ключевым словам — пропускаем дубликаты
        if (prev.some(c => c.id === d.id)) return prev;
        return [{
          id: d.id,
          url: d.url,
          platform: d.platform,
          username: d.username ?? d.uploader ?? '',
          title: d.title,
          thumbnail: d.thumbnail ?? '',
          viewCount: d.viewCount ?? 0,
          keyword: d.keyword,
          state: 'analyzing',
        }, ...prev];
      });
      setStats(s => ({ ...s, scanned: s.scanned + 1 }));
      return;
    }
    if (d.type === 'result') {
      setStats(s => ({
        ...s,
        found: s.found + 1,
        threats: d.riskScore >= 60 ? s.threats + 1 : s.threats,
      }));

      setCards(prev => prev.map(c => c.id === d.id ? {
        ...c,
        state: 'done',
        category: d.category,
        riskScore: d.riskScore,
        confidence: d.confidence,
        detectedMarkers: d.detectedMarkers,
        explanation: d.explanation,
        legalReference: d.legalReference,
      } : c));

      // AI-аналитик комментирует находку (кросс-ссылка на реестр до добавления поста)
      const existingPosts = useAppStore.getState().posts;
      const comment = composeAnalystComment(d, existingPosts);
      pushAnalyst(comment.text, comment.tone, d.id);

      // Save non-safe results to dashboard
      if (d.riskScore >= 30) {
        const post: Post = {
          id: d.id,
          platform: d.platform as Platform,
          username: d.username ?? '',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${d.id}`,
          caption: d.title,
          hashtags: [],
          thumbnailColor: '#1c1f29',
          videoTranscript: '',
          ocrText: '',
          riskScore: d.riskScore,
          category: d.category,
          detectedMarkers: d.detectedMarkers ?? [],
          timestamp: new Date().toISOString(),
          status: 'pending',
          views: d.viewCount,
          url: d.url,
          requisites: Array.isArray(d.requisites) ? d.requisites : [],
          region: detectRegion(d.title + ' ' + (d.explanation ?? '')),
        };
        addPost(post);
      }
      return;
    }
    if (d.type === 'error') {
      if (d.message) setStatusMsg(`⚠ ${d.message}`);
    }
  }, [addPost, pushAnalyst]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startScan = useCallback(async () => {
    stopPolling();
    setCards([]);
    setStats({ scanned: 0, found: 0, threats: 0 });
    setStatusMsg('Подключение…');
    setScanState('scanning');

    const params = new URLSearchParams({
      keywords: keywords.trim(),
      platforms: [...platforms].join(','),
      limit: String(limit),
    });

    let scanId: string;
    try {
      const res = await fetch(`${BACKEND}/api/livescan/start?${params}`, { method: 'POST' });
      const data = await res.json();
      if (!data.scanId) throw new Error('Сервер не вернул scanId');
      scanId = data.scanId;
      scanIdRef.current = scanId;
    } catch (err: any) {
      setStatusMsg(`Ошибка подключения к серверу: ${err.message ?? err}`);
      setScanState('done');
      return;
    }

    let cursor = 0;
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/livescan/poll?scanId=${scanId}&cursor=${cursor}`);
        if (!res.ok) throw new Error(`poll ${res.status}`);
        const data = await res.json();
        cursor = data.cursor ?? cursor;
        for (const ev of data.events ?? []) applyEvent(ev);
        if (data.done) {
          stopPolling();
          setStats(s => ({ ...s, scanned: data.scanned ?? s.scanned, found: data.found ?? s.found }));
          setStatusMsg(`Сканирование завершено: ${data.scanned ?? '—'} видео проверено`);
          setScanState('done');
        }
      } catch (err: any) {
        stopPolling();
        setStatusMsg(`Потеряна связь с сервером: ${err.message ?? err}`);
        setScanState('done');
      }
    };

    await poll();
    pollRef.current = setInterval(poll, 1200);
  }, [keywords, platforms, limit, applyEvent]);

  const stopScan = () => {
    stopPolling();
    const id = scanIdRef.current;
    if (id) fetch(`${BACKEND}/api/livescan/stop?scanId=${id}`, { method: 'POST' }).catch(() => {});
    setScanState('done');
    setStatusMsg('Сканирование остановлено');
  };

  useEffect(() => () => stopPolling(), []);

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative radar-pulse-container w-9 h-9 flex items-center justify-center">
            {scanState === 'scanning' && (
              <>
                <div className="radar-pulse-ring" />
                <div className="radar-pulse-ring" style={{ animationDelay: '1s' }} />
                <div className="radar-pulse-ring" style={{ animationDelay: '2s' }} />
              </>
            )}
            <span className="material-symbols-outlined text-primary text-3xl relative z-10" style={{ ...sym, textShadow: scanState === 'scanning' ? '0 0 18px rgba(206,255,26,0.6)' : '' }}>radar</span>
          </div>
          <h1 className="num-display text-4xl md:text-5xl text-on-surface ml-1">Live Сканер</h1>
          {scanState === 'scanning' && (
            <span className="text-xs font-code-sm px-2.5 py-1 rounded-lg border border-error/40 text-error bg-error-container/20 animate-pulse ml-2">
              LIVE
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-5">

          {/* ── Control panel ── */}
          <div className="space-y-4">
            <div className="glass-card p-4">
              <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-3">
                КЛЮЧЕВЫЕ СЛОВА
              </label>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                rows={3}
                disabled={scanState === 'scanning'}
                placeholder="казино, заработок, пирамида..."
                className="w-full bg-surface-container-lowest/60 border border-white/10 rounded px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary-container/40 resize-none disabled:opacity-50"
              />
              <p className="text-xs text-on-surface-variant/50 mt-1.5">Несколько запросов — через запятую</p>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {PRESET_QUERIES.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setKeywords(p.keywords)}
                    disabled={scanState === 'scanning'}
                    className="text-xs px-3 py-1 rounded-full border border-white/10 text-on-surface-variant hover:border-white/30 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card p-4">
              <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-3">
                ПЛАТФОРМЫ
              </label>
              <div className="flex gap-2">
                {(['youtube', 'tiktok'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    disabled={scanState === 'scanning'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border font-label-caps text-label-caps tracking-widest text-xs transition-all disabled:opacity-50 ${
                      platforms.has(p)
                        ? 'border-white/25 text-white bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'border-white/10 text-on-surface-variant hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm" style={sym}>
                      {platformIcon[p]}
                    </span>
                    {p === 'youtube' ? 'YouTube' : 'TikTok'}
                  </button>
                ))}
              </div>
              {platforms.has('tiktok') && (
                <p className="text-xs text-warning/70 mt-2 font-code-sm">
                  ⚠ TikTok: поиск может быть ограничен без авторизации
                </p>
              )}
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  ЛИМИТ ВИДЕО
                </label>
                <span className="font-code-sm text-secondary-container">{limit}</span>
              </div>
              <input
                type="range"
                min={5} max={30} step={5}
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                disabled={scanState === 'scanning'}
                className="w-full accent-[#ceff1a] disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-on-surface-variant/40 mt-1">
                <span>5</span><span>15</span><span>30</span>
              </div>
            </div>

            {/* Start/Stop */}
            {scanState !== 'scanning' ? (
              <button
                onClick={startScan}
                className="w-full btn-cyber-skew-primary justify-center text-sm tracking-wide py-3"
              >
                <span>
                  <span className="material-symbols-outlined text-lg" style={sym}>radar</span>
                  НАЧАТЬ СКАНИРОВАНИЕ
                </span>
              </button>
            ) : (
              <button
                onClick={stopScan}
                className="w-full btn-cyber-skew justify-center text-sm tracking-wide py-3 border-error/30 text-error hover:bg-error-container/20 hover:border-error"
              >
                <span>
                  <span className="material-symbols-outlined text-lg animate-pulse" style={sym}>stop</span>
                  ОСТАНОВИТЬ
                </span>
              </button>
            )}

            {/* Stats */}
            <div className="glass-card p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="num-display text-3xl text-primary">{stats.scanned}</div>
                  <div className="text-[11px] text-on-surface-variant mt-1">Найдено</div>
                </div>
                <div>
                  <div className="num-display text-3xl text-tertiary">{stats.found}</div>
                  <div className="text-[11px] text-on-surface-variant mt-1">Проверено</div>
                </div>
                <div>
                  <div className="num-display text-3xl text-error">{stats.threats}</div>
                  <div className="text-[11px] text-on-surface-variant mt-1">Угрозы</div>
                </div>
              </div>

              {statusMsg && (
                <div className="mt-3 text-xs font-code-sm text-on-surface-variant/60 border-t border-white/5 pt-3">
                  {statusMsg}
                </div>
              )}
            </div>
          </div>

          {/* ── Live feed ── */}
          <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
            {cards.length === 0 && scanState === 'idle' && (
              <div className="glass-card p-16 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-4" style={sym}>radar</span>
                <p className="text-on-surface-variant font-code-sm text-code-sm">
                  Выбери ключевые слова и запусти сканирование
                </p>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {cards.map((card) => {
                const isAnalyzing = card.state === 'analyzing';
                const colors = card.riskScore !== undefined ? getRiskColor(card.riskScore) : null;
                return (
                  <motion.a
                    key={card.id}
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: -16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className={`glass-card block hover:bg-white/[0.03] transition-colors cursor-pointer card-materialize ${isAnalyzing ? 'scanning-border' : ''}`}
                    style={!isAnalyzing && colors ? { borderLeft: `3px solid ${colors.bar}` } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      <div className="relative shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-surface-container-lowest border border-white/10">
                        {card.thumbnail ? (
                          <img src={card.thumbnail} alt="" className={`w-full h-full object-cover transition-all duration-500 ${isAnalyzing ? 'grayscale brightness-75' : ''}`} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl" style={sym}>
                              {platformIcon[card.platform]}
                            </span>
                          </div>
                        )}

                        {/* SCAN BEAM overlay while analyzing */}
                        {isAnalyzing && (
                          <>
                            <div className="scan-beam-grid" />
                            <div className="scan-beam" />
                            <span className="absolute top-0.5 left-1 z-10 font-code-sm text-[8px] tracking-widest text-primary animate-pulse">СКАН</span>
                          </>
                        )}

                        {/* Platform badge */}
                        <div
                          className="absolute bottom-0 left-0 right-0 text-center py-0.5 font-label-caps text-[9px] tracking-widest z-10"
                          style={{ background: `${platformColor[card.platform]}cc` }}
                        >
                          {card.platform.toUpperCase()}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-on-surface truncate">{card.title || '—'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-on-surface-variant/60">@{card.username}</span>
                              {card.viewCount > 0 && (
                                <span className="text-xs text-on-surface-variant/40 font-code-sm">
                                  {formatViews(card.viewCount)} просм.
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-code-sm text-on-surface-variant/30 mt-0.5 block">
                              запрос: {card.keyword}
                            </span>
                          </div>

                          {/* Status / result */}
                          <div className="shrink-0 text-right">
                            {isAnalyzing ? (
                              <div className="flex items-center gap-1.5 text-primary">
                                <span className="material-symbols-outlined text-sm animate-spin" style={sym}>progress_activity</span>
                                <span className="text-xs font-code-sm">Claude думает…</span>
                              </div>
                            ) : colors ? (
                              <div className="verdict-stamp">
                                <div className={`num-display text-2xl ${colors.text}`}>
                                  {card.riskScore}<span className="text-xs text-on-surface-variant">/100</span>
                                </div>
                                <div className={`text-xs font-label-caps tracking-widest ${colors.text}`}>
                                  {getCategoryLabel(card.category!)}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Markers */}
                        {!isAnalyzing && card.detectedMarkers && card.detectedMarkers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {card.detectedMarkers.slice(0, 3).map(m => (
                              <span
                                key={m}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-error/25 text-error/80 bg-error-container/10 font-code-sm"
                              >
                                {m}
                              </span>
                            ))}
                            {card.detectedMarkers.length > 3 && (
                              <span className="text-[10px] text-on-surface-variant/40">+{card.detectedMarkers.length - 3}</span>
                            )}
                          </div>
                        )}

                        {/* Typed Claude verdict */}
                        {!isAnalyzing && card.explanation && (
                          <p className="text-[11px] text-on-surface-variant/70 mt-2 font-code-sm leading-relaxed">
                            <Typewriter text={card.explanation.slice(0, 160)} />
                          </p>
                        )}

                        {/* Risk bar */}
                        {!isAnalyzing && card.riskScore !== undefined && (
                          <div className="w-full bg-white/[0.06] rounded-full h-1 mt-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${card.riskScore}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className="h-1 rounded-full"
                              style={{ backgroundColor: colors?.bar }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </AnimatePresence>

            {scanState === 'scanning' && cards.length > 0 && (
              <div className="text-center py-4">
                <span className="text-xs text-on-surface-variant/40 font-code-sm animate-pulse">
                  Сканирование продолжается...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
