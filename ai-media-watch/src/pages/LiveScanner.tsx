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
  { label: 'Казино',    keywords: 'казино онлайн,слоты,ставки' },
  { label: 'Пирамиды',  keywords: 'заработок без вложений,пассивный доход,MLM' },
  { label: 'Мошенники', keywords: 'выиграй приз,пришли деньги получи больше,форекс сигналы' },
  { label: 'Крипто',    keywords: 'крипто заработок,bitcoin easy money,инвестиции гарантия' },
];

type ScanState = 'idle' | 'scanning' | 'done';
type PageMode  = 'live' | 'deep';

// ── Live scan card ─────────────────────────────────────────────────────────────
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
  category?: 'safe' | 'casino' | 'pyramid' | 'fraud';
  riskScore?: number;
  confidence?: number;
  detectedMarkers?: string[];
  explanation?: string;
  legalReference?: string;
}

// ── Deep scan card ─────────────────────────────────────────────────────────────
interface Segment {
  start: number;
  end: number;
  text: string;
  ts: string;
}

interface DeepCard {
  id: string;
  url: string;
  platform: 'youtube';
  username: string;
  title: string;
  thumbnail: string;
  viewCount: number;
  duration: number;
  keyword: string;
  state: 'analyzing' | 'transcribing' | 'done';
  category?: 'safe' | 'casino' | 'pyramid' | 'fraud';
  riskScore?: number;
  confidence?: number;
  detectedMarkers?: string[];
  explanation?: string;
  legalReference?: string;
  fraudTimestamps?: string[];
  segments?: Segment[];
  transcript?: string;
  requisites?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const platformIcon: Record<string, string> = {
  youtube: 'smart_display', tiktok: 'videocam', instagram: 'photo_camera',
};
const platformColor: Record<string, string> = {
  youtube: '#ff5640', tiktok: '#9aa0a6', instagram: '#ff3b6b',
};

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function getYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

function Typewriter({ text, speed = 16 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="text-primary animate-pulse">▋</span>}
    </>
  );
}

// ── DeepScanCard ───────────────────────────────────────────────────────────────
function DeepScanCard({ card }: { card: DeepCard }) {
  const [showPlayer, setShowPlayer]         = useState(false);
  const [playerStartSec, setPlayerStartSec] = useState(0);
  const [playerKey, setPlayerKey]           = useState(0); // force iframe reload on seek
  const [showTranscript, setShowTranscript] = useState(false);

  const colors    = card.riskScore !== undefined ? getRiskColor(card.riskScore) : null;
  const videoId   = getYouTubeId(card.url);
  const fraudSet  = new Set(card.fraudTimestamps ?? []);
  const isWorking = card.state !== 'done';

  function seekTo(ts: string) {
    const sec = parseTimestamp(ts);
    setPlayerStartSec(sec);
    setPlayerKey(k => k + 1);
    setShowPlayer(true);
  }

  const hasFraud       = (card.fraudTimestamps ?? []).length > 0;
  const hasSegments    = (card.segments ?? []).length > 0;
  const hasTranscript  = hasSegments || !!card.transcript;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className={`glass-card overflow-hidden ${isWorking ? 'scanning-border' : ''}`}
      style={!isWorking && colors ? { borderLeft: `3px solid ${colors.bar}` } : undefined}
    >
      {/* ── Video / Thumbnail ── */}
      {showPlayer && videoId ? (
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          <iframe
            key={playerKey}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${playerStartSec}&rel=0&enablejsapi=1`}
            className="w-full h-full"
            allow="autoplay; accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div
          className="relative w-full bg-surface-container-lowest cursor-pointer group"
          style={{ aspectRatio: '16/9' }}
          onClick={() => setShowPlayer(true)}
        >
          {card.thumbnail ? (
            <img
              src={card.thumbnail}
              alt=""
              className={`w-full h-full object-cover transition-all duration-500 ${isWorking ? 'grayscale brightness-50' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant/20 text-5xl" style={sym}>smart_display</span>
            </div>
          )}

          {/* Scan overlay */}
          {isWorking && (
            <>
              <div className="scan-beam-grid absolute inset-0" />
              <div className="scan-beam absolute inset-0" />
            </>
          )}

          {/* Play overlay (non-working) */}
          {!isWorking && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                <span className="material-symbols-outlined text-on-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </div>
            </div>
          )}

          {/* Working state label */}
          {isWorking && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl animate-spin" style={sym}>progress_activity</span>
              <span className="text-xs text-primary font-code-sm animate-pulse">
                {card.state === 'transcribing' ? 'Whisper транскрибирует…' : 'Claude анализирует…'}
              </span>
            </div>
          )}

          {/* Duration badge */}
          {card.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[11px] font-code-sm text-white">
              {fmtDuration(card.duration)}
            </div>
          )}

          {/* Platform badge */}
          <div
            className="absolute bottom-0 left-0 py-0.5 px-2 font-label-caps text-[9px] tracking-widest"
            style={{ background: `${platformColor[card.platform]}cc` }}
          >
            {card.platform.toUpperCase()}
          </div>
        </div>
      )}

      {/* ── Card body ── */}
      <div className="p-4 space-y-3">

        {/* Title + risk score */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-on-surface hover:text-primary transition-colors line-clamp-2 block"
              onClick={e => e.stopPropagation()}
            >
              {card.title || '—'}
            </a>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs text-on-surface-variant/60">@{card.username}</span>
              {card.viewCount > 0 && (
                <span className="text-xs text-on-surface-variant/40 font-code-sm">{formatViews(card.viewCount)} просм.</span>
              )}
              <span className="text-[10px] font-code-sm text-on-surface-variant/30">ключ: {card.keyword}</span>
            </div>
          </div>

          {isWorking ? (
            <div className="shrink-0 flex flex-col items-center gap-1 text-primary pt-0.5">
              <span className="material-symbols-outlined text-lg animate-spin" style={sym}>progress_activity</span>
              <span className="text-[9px] font-code-sm whitespace-nowrap">
                {card.state === 'transcribing' ? 'Whisper…' : 'Claude…'}
              </span>
            </div>
          ) : colors ? (
            <div className="shrink-0 text-right">
              <div className={`num-display text-2xl ${colors.text}`}>
                {card.riskScore}
                <span className="text-xs text-on-surface-variant">/100</span>
              </div>
              <div className={`text-xs font-label-caps tracking-widest ${colors.text}`}>
                {getCategoryLabel(card.category!)}
              </div>
            </div>
          ) : null}
        </div>

        {/* Fraud timestamps — main feature */}
        {!isWorking && hasFraud && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-error/80 font-code-sm">
              <span className="material-symbols-outlined text-sm" style={sym}>warning</span>
              Мошенничество на таймлаймах:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(card.fraudTimestamps ?? []).map((ts) => (
                <button
                  key={ts}
                  onClick={() => seekTo(ts)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container/25 border border-error/40 text-error text-xs font-code-sm hover:bg-error-container/45 hover:border-error/70 transition-all active:scale-95"
                  style={{ minHeight: 32 }}
                >
                  <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                  {ts}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detected markers */}
        {!isWorking && (card.detectedMarkers ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(card.detectedMarkers ?? []).slice(0, 5).map((m) => (
              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded border border-error/25 text-error/80 bg-error-container/10 font-code-sm">
                {m}
              </span>
            ))}
            {(card.detectedMarkers ?? []).length > 5 && (
              <span className="text-[10px] text-on-surface-variant/40">+{(card.detectedMarkers ?? []).length - 5}</span>
            )}
          </div>
        )}

        {/* Claude explanation */}
        {!isWorking && card.explanation && (
          <p className="text-[11px] text-on-surface-variant/70 font-code-sm leading-relaxed">
            <Typewriter text={card.explanation.slice(0, 220)} />
          </p>
        )}

        {/* Risk bar */}
        {!isWorking && card.riskScore !== undefined && (
          <div className="w-full bg-white/[0.06] rounded-full h-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${card.riskScore}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="h-1 rounded-full"
              style={{ backgroundColor: colors?.bar }}
            />
          </div>
        )}

        {/* Timestamped transcript accordion */}
        {!isWorking && hasTranscript && (
          <div>
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface transition-colors font-code-sm"
            >
              <motion.span
                animate={{ rotate: showTranscript ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="material-symbols-outlined text-sm"
                style={sym}
              >
                chevron_right
              </motion.span>
              {hasSegments
                ? `Транскрипция с тайм-лайном (${card.segments!.length} фрагм.)`
                : 'Транскрипция'}
            </button>

            <AnimatePresence>
              {showTranscript && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/[0.07] bg-surface-container-lowest/50 divide-y divide-white/[0.04]">
                    {hasSegments ? (
                      card.segments!.map((seg, i) => {
                        const isFraud = fraudSet.has(seg.ts);
                        return (
                          <button
                            key={i}
                            onClick={() => seekTo(seg.ts)}
                            className={`w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-white/[0.05] transition-colors ${
                              isFraud ? 'bg-error-container/10 hover:bg-error-container/15' : ''
                            }`}
                          >
                            <span
                              className={`text-[10px] font-code-sm shrink-0 mt-0.5 tabular-nums ${
                                isFraud ? 'text-error' : 'text-primary/50'
                              }`}
                            >
                              {seg.ts}
                            </span>
                            {isFraud && (
                              <span className="material-symbols-outlined text-xs text-error shrink-0 mt-0.5" style={sym}>warning</span>
                            )}
                            <span className={`text-xs leading-relaxed ${isFraud ? 'text-error/80 font-medium' : 'text-on-surface-variant/65'}`}>
                              {seg.text}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="p-3 text-xs text-on-surface-variant/60 font-code-sm leading-relaxed">
                        {card.transcript}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main LiveScanner page ──────────────────────────────────────────────────────
export default function LiveScanner() {
  const addPost    = useAppStore((s) => s.addPost);
  const pushAnalyst = useAppStore((s) => s.pushAnalyst);

  // Shared controls
  const [mode, setMode]           = useState<PageMode>('live');
  const [keywords, setKeywords]   = useState('казино онлайн,заработок без вложений');
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(['youtube']));
  const [limit, setLimit]         = useState(15);

  // Live scan state
  const [liveScanState, setLiveScanState] = useState<ScanState>('idle');
  const [liveCards, setLiveCards]         = useState<LiveCard[]>([]);
  const [liveStats, setLiveStats]         = useState({ scanned: 0, found: 0, threats: 0 });
  const [liveStatus, setLiveStatus]       = useState('');

  // Deep scan state
  const [deepScanState, setDeepScanState] = useState<ScanState>('idle');
  const [deepCards, setDeepCards]         = useState<DeepCard[]>([]);
  const [deepScanned, setDeepScanned]     = useState(0);
  const [deepStatus, setDeepStatus]       = useState('');

  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanIdRef   = useRef<string | null>(null);

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) { if (next.size > 1) next.delete(p); }
      else next.add(p);
      return next;
    });

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // ── Live scan event handler ────────────────────────────────────────────────
  const applyLiveEvent = useCallback((d: any) => {
    if (d.type === 'status') { setLiveStatus(d.message); return; }
    if (d.type === 'found') {
      setLiveCards((prev) => {
        if (prev.some((c) => c.id === d.id)) return prev;
        return [{ id: d.id, url: d.url, platform: d.platform, username: d.username ?? d.uploader ?? '',
          title: d.title, thumbnail: d.thumbnail ?? '', viewCount: d.viewCount ?? 0,
          keyword: d.keyword, state: 'analyzing' }, ...prev];
      });
      setLiveStats((s) => ({ ...s, scanned: s.scanned + 1 }));
      return;
    }
    if (d.type === 'result') {
      setLiveStats((s) => ({ ...s, found: s.found + 1, threats: d.riskScore >= 60 ? s.threats + 1 : s.threats }));
      setLiveCards((prev) => prev.map((c) => c.id === d.id ? {
        ...c, state: 'done', category: d.category, riskScore: d.riskScore,
        confidence: d.confidence, detectedMarkers: d.detectedMarkers,
        explanation: d.explanation, legalReference: d.legalReference,
      } : c));
      const comment = composeAnalystComment(d, useAppStore.getState().posts);
      pushAnalyst(comment.text, comment.tone, d.id);
      if (d.riskScore >= 30) {
        addPost({
          id: d.id, platform: d.platform as Platform, username: d.username ?? '',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${d.id}`,
          caption: d.title, hashtags: [], thumbnailColor: '#1c1f29',
          videoTranscript: '', ocrText: '', riskScore: d.riskScore,
          category: d.category, detectedMarkers: d.detectedMarkers ?? [],
          timestamp: new Date().toISOString(), status: 'pending',
          views: d.viewCount, url: d.url,
          requisites: Array.isArray(d.requisites) ? d.requisites : [],
          region: detectRegion(d.title + ' ' + (d.explanation ?? '')),
        } as Post);
      }
      return;
    }
    if (d.type === 'error' && d.message) setLiveStatus(`⚠ ${d.message}`);
  }, [addPost, pushAnalyst]);

  // ── Deep scan event handler ────────────────────────────────────────────────
  const applyDeepEvent = useCallback((d: any) => {
    if (d.type === 'status') {
      setDeepStatus(d.message);
      // When server signals Whisper started for a card, update its state
      if (d.transcribingId) {
        setDeepCards((prev) => prev.map((c) =>
          c.id === d.transcribingId ? { ...c, state: 'transcribing' } : c
        ));
      }
      return;
    }
    if (d.type === 'found') {
      setDeepCards((prev) => {
        if (prev.some((c) => c.id === d.id)) return prev;
        return [{ id: d.id, url: d.url, platform: 'youtube', username: d.username ?? d.uploader ?? '',
          title: d.title, thumbnail: d.thumbnail ?? '', viewCount: d.viewCount ?? 0,
          duration: d.duration ?? 0, keyword: d.keyword, state: 'analyzing',
        }, ...prev];
      });
      setDeepScanned((n) => n + 1);
      return;
    }
    if (d.type === 'result') {
      setDeepCards((prev) => prev.map((c) => c.id === d.id ? {
        ...c, state: 'done', category: d.category, riskScore: d.riskScore,
        confidence: d.confidence, detectedMarkers: d.detectedMarkers,
        explanation: d.explanation, legalReference: d.legalReference,
        fraudTimestamps: d.fraudTimestamps ?? [], segments: d.segments ?? [],
        transcript: d.transcript ?? '', requisites: d.requisites ?? [],
      } : c));
      if ((d.riskScore ?? 0) >= 30) {
        addPost({
          id: d.id, platform: 'youtube' as Platform, username: d.username ?? '',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${d.id}`,
          caption: d.title, hashtags: [], thumbnailColor: '#1c1f29',
          videoTranscript: d.transcript ?? '', ocrText: '',
          riskScore: d.riskScore, category: d.category,
          detectedMarkers: d.detectedMarkers ?? [],
          timestamp: new Date().toISOString(), status: 'pending',
          views: d.viewCount, url: d.url,
          requisites: Array.isArray(d.requisites) ? d.requisites : [],
          region: detectRegion(d.title + ' ' + (d.explanation ?? '')),
        } as Post);
      }
      return;
    }
    if (d.type === 'error' && d.message) setDeepStatus(`⚠ ${d.message}`);
  }, [addPost]);

  // ── Polling loop (generic — used by both modes) ───────────────────────────
  function startPolling(scanId: string, applyEvent: (d: any) => void, onDone: (data: any) => void) {
    let cursor = 0;
    const poll = async () => {
      try {
        const res  = await fetch(`${BACKEND}/api/livescan/poll?scanId=${scanId}&cursor=${cursor}`);
        if (!res.ok) throw new Error(`poll ${res.status}`);
        const data = await res.json();
        cursor = data.cursor ?? cursor;
        for (const ev of data.events ?? []) applyEvent(ev);
        if (data.done) { stopPolling(); onDone(data); }
      } catch (err: any) {
        stopPolling();
        applyEvent({ type: 'error', message: `Потеряна связь: ${(err as Error).message}` });
        onDone({});
      }
    };
    poll();
    pollRef.current = setInterval(poll, 1200);
  }

  // ── Start live scan ────────────────────────────────────────────────────────
  const startLiveScan = useCallback(async () => {
    stopPolling();
    setLiveCards([]);
    setLiveStats({ scanned: 0, found: 0, threats: 0 });
    setLiveStatus('Подключение…');
    setLiveScanState('scanning');

    const params = new URLSearchParams({
      keywords: keywords.trim(),
      platforms: [...platforms].join(','),
      limit: String(limit),
    });

    try {
      const res  = await fetch(`${BACKEND}/api/livescan/start?${params}`, { method: 'POST' });
      const data = await res.json();
      if (!data.scanId) throw new Error('Нет scanId');
      scanIdRef.current = data.scanId;
      startPolling(data.scanId, applyLiveEvent, (d) => {
        setLiveStats((s) => ({ ...s, scanned: d.scanned ?? s.scanned, found: d.found ?? s.found }));
        setLiveStatus(`Завершено: ${d.scanned ?? '—'} видео проверено`);
        setLiveScanState('done');
      });
    } catch (err: any) {
      setLiveStatus(`Ошибка: ${err.message}`);
      setLiveScanState('done');
    }
  }, [keywords, platforms, limit, applyLiveEvent]);

  // ── Start deep scan ────────────────────────────────────────────────────────
  const startDeepScan = useCallback(async () => {
    stopPolling();
    setDeepCards([]);
    setDeepScanned(0);
    setDeepStatus('Подключение…');
    setDeepScanState('scanning');

    const params = new URLSearchParams({
      keywords: keywords.trim(),
      limit: String(Math.min(limit, 15)),
    });

    try {
      const res  = await fetch(`${BACKEND}/api/livescan/deep/start?${params}`, { method: 'POST' });
      const data = await res.json();
      if (!data.scanId) throw new Error('Нет scanId');
      scanIdRef.current = data.scanId;
      startPolling(data.scanId, applyDeepEvent, (d) => {
        setDeepStatus(`Готово: ${d.scanned ?? deepScanned} видео проанализировано`);
        setDeepScanState('done');
      });
    } catch (err: any) {
      setDeepStatus(`Ошибка: ${err.message}`);
      setDeepScanState('done');
    }
  }, [keywords, limit, applyDeepEvent]);

  const stopScan = () => {
    stopPolling();
    const id = scanIdRef.current;
    if (id) fetch(`${BACKEND}/api/livescan/stop?scanId=${id}`, { method: 'POST' }).catch(() => {});
    if (mode === 'live') { setLiveScanState('done'); setLiveStatus('Остановлено'); }
    else { setDeepScanState('done'); setDeepStatus('Остановлено'); }
  };

  // Load persisted results on mount
  useEffect(() => {
    const load = async (type: 'live' | 'deep') => {
      try {
        const res  = await fetch(`${BACKEND}/api/livescan/results?type=${type}&limit=50`);
        const data = await res.json();
        if (!Array.isArray(data.results) || data.results.length === 0) return;

        if (type === 'live') {
          setLiveCards(data.results.map((r: any) => ({
            id: r.id, url: r.url, platform: r.platform,
            username: r.username, title: r.title, thumbnail: r.thumbnail,
            viewCount: r.viewCount, keyword: r.keyword,
            state: 'done' as const,
            category: r.category, riskScore: r.riskScore, confidence: r.confidence,
            detectedMarkers: r.detectedMarkers, explanation: r.explanation,
            legalReference: r.legalReference,
          })));
        } else {
          setDeepCards(data.results.map((r: any) => ({
            id: r.id, url: r.url, platform: 'youtube' as const,
            username: r.username, title: r.title, thumbnail: r.thumbnail,
            viewCount: r.viewCount, duration: r.duration ?? 0, keyword: r.keyword,
            state: 'done' as const,
            category: r.category, riskScore: r.riskScore, confidence: r.confidence,
            detectedMarkers: r.detectedMarkers, explanation: r.explanation,
            legalReference: r.legalReference,
            fraudTimestamps: r.fraudTimestamps ?? [],
            segments: r.segments ?? [],
            transcript: r.transcript ?? '',
            requisites: r.requisites ?? [],
          })));
        }
      } catch { /* DB unavailable — start empty */ }
    };

    load('live');
    load('deep');
    return () => stopPolling();
  }, []);

  // Clear results
  const clearResults = async (type: 'live' | 'deep') => {
    try {
      await fetch(`${BACKEND}/api/livescan/results?type=${type}`, { method: 'DELETE' });
    } catch { /* ignore */ }
    if (type === 'live') {
      setLiveCards([]);
      setLiveStats({ scanned: 0, found: 0, threats: 0 });
      setLiveStatus('');
    } else {
      setDeepCards([]);
      setDeepScanned(0);
      setDeepStatus('');
    }
  };

  const activeScanState = mode === 'live' ? liveScanState : deepScanState;
  const isScanning      = activeScanState === 'scanning';

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative radar-pulse-container w-9 h-9 flex items-center justify-center">
            {isScanning && (
              <>
                <div className="radar-pulse-ring" />
                <div className="radar-pulse-ring" style={{ animationDelay: '1s' }} />
                <div className="radar-pulse-ring" style={{ animationDelay: '2s' }} />
              </>
            )}
            <span
              className="material-symbols-outlined text-primary text-3xl relative z-10"
              style={{ ...sym, textShadow: isScanning ? '0 0 18px rgba(206,255,26,0.6)' : '' }}
            >
              radar
            </span>
          </div>
          <h1 className="num-display text-4xl md:text-5xl text-on-surface ml-1">Live Сканер</h1>
          {isScanning && (
            <span className="text-xs font-code-sm px-2.5 py-1 rounded-lg border border-error/40 text-error bg-error-container/20 animate-pulse ml-2">
              LIVE
            </span>
          )}
        </div>

        {/* ── Mode tabs ── */}
        <div className="flex gap-1 mb-5 p-1 bg-surface-container rounded-xl w-fit">
          {([
            { id: 'live' as PageMode, icon: 'ondemand_video', label: 'ОБЫЧНЫЕ ВИДЕО' },
            { id: 'deep' as PageMode, icon: 'find_in_page',   label: 'ДЛИННЫЕ ВИДЕО' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              disabled={isScanning}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-label-caps tracking-widest transition-all disabled:opacity-50 ${
                mode === tab.id
                  ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(206,255,26,0.25)]'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm" style={sym}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-5">

          {/* ── Control panel ── */}
          <div className="space-y-4">

            {/* Keywords */}
            <div className="glass-card p-4">
              <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-3">
                КЛЮЧЕВЫЕ СЛОВА
              </label>
              <textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={3}
                disabled={isScanning}
                placeholder="казино, заработок, пирамида…"
                className="w-full bg-surface-container-lowest/60 border border-white/10 rounded px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary-container/40 resize-none disabled:opacity-50"
              />
              <p className="text-xs text-on-surface-variant/50 mt-1.5">Несколько — через запятую</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {PRESET_QUERIES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setKeywords(p.keywords)}
                    disabled={isScanning}
                    className="text-xs px-3 py-1 rounded-full border border-white/10 text-on-surface-variant hover:border-white/30 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms — live scan only */}
            {mode === 'live' && (
              <div className="glass-card p-4">
                <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-3">
                  ПЛАТФОРМЫ
                </label>
                <div className="flex gap-2">
                  {(['youtube', 'tiktok'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      disabled={isScanning}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border font-label-caps text-label-caps tracking-widest text-xs transition-all disabled:opacity-50 ${
                        platforms.has(p)
                          ? 'border-white/25 text-white bg-white/10'
                          : 'border-white/10 text-on-surface-variant hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm" style={sym}>{platformIcon[p]}</span>
                      {p === 'youtube' ? 'YouTube' : 'TikTok'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Deep scan note */}
            {mode === 'deep' && (
              <div className="glass-card p-4 border border-primary/20">
                <div className="flex gap-2.5 items-start">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5" style={sym}>info</span>
                  <div className="space-y-1">
                    <p className="text-xs text-on-surface font-semibold">Глубокий анализ</p>
                    <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                      Скачивает аудио каждого видео и транскрибирует через Whisper. Находит мошенничество в любом месте видео с точным таймлаймом. Только YouTube. До 15 видео. Занимает 5–20 мин.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Limit */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  ЛИМИТ ВИДЕО
                </label>
                <span className="font-code-sm text-secondary-container">
                  {mode === 'deep' ? Math.min(limit, 15) : limit}
                </span>
              </div>
              <input
                type="range"
                min={mode === 'deep' ? 3 : 5}
                max={mode === 'deep' ? 15 : 30}
                step={mode === 'deep' ? 1 : 5}
                value={mode === 'deep' ? Math.min(limit, 15) : limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={isScanning}
                className="w-full accent-[#ceff1a] disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-on-surface-variant/40 mt-1">
                {mode === 'deep' ? <><span>3</span><span>8</span><span>15</span></> : <><span>5</span><span>15</span><span>30</span></>}
              </div>
            </div>

            {/* Start / Stop */}
            {!isScanning ? (
              <button
                onClick={mode === 'live' ? startLiveScan : startDeepScan}
                className="w-full btn-cyber-skew-primary justify-center text-sm tracking-wide py-3"
              >
                <span>
                  <span className="material-symbols-outlined text-lg" style={sym}>
                    {mode === 'live' ? 'radar' : 'find_in_page'}
                  </span>
                  {mode === 'live' ? 'НАЧАТЬ СКАНИРОВАНИЕ' : 'НАЧАТЬ ГЛУБОКИЙ АНАЛИЗ'}
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
              {mode === 'live' ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="num-display text-3xl text-primary">{liveStats.scanned}</div>
                    <div className="text-[11px] text-on-surface-variant mt-1">Найдено</div>
                  </div>
                  <div>
                    <div className="num-display text-3xl text-tertiary">{liveStats.found}</div>
                    <div className="text-[11px] text-on-surface-variant mt-1">Проверено</div>
                  </div>
                  <div>
                    <div className="num-display text-3xl text-error">{liveStats.threats}</div>
                    <div className="text-[11px] text-on-surface-variant mt-1">Угрозы</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="num-display text-3xl text-primary">{deepScanned}</div>
                    <div className="text-[11px] text-on-surface-variant mt-1">Видео найдено</div>
                  </div>
                  <div>
                    <div className="num-display text-3xl text-error">
                      {deepCards.filter((c) => (c.riskScore ?? 0) >= 60).length}
                    </div>
                    <div className="text-[11px] text-on-surface-variant mt-1">Угрозы</div>
                  </div>
                </div>
              )}

              {(mode === 'live' ? liveStatus : deepStatus) && (
                <div className="mt-3 text-xs font-code-sm text-on-surface-variant/60 border-t border-white/5 pt-3 leading-relaxed">
                  {mode === 'live' ? liveStatus : deepStatus}
                </div>
              )}

              {/* Clear button */}
              {(mode === 'live' ? liveCards : deepCards).length > 0 && !isScanning && (
                <button
                  onClick={() => clearResults(mode)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-on-surface-variant/50 hover:text-error transition-colors border border-white/[0.06] hover:border-error/30 rounded-xl py-2 font-code-sm"
                >
                  <span className="material-symbols-outlined text-sm" style={sym}>delete_sweep</span>
                  Очистить результаты
                </button>
              )}
            </div>
          </div>

          {/* ── Results pane ── */}
          <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">

            {/* ── Live feed ── */}
            {mode === 'live' && (
              <>
                {liveCards.length === 0 && liveScanState === 'idle' && (
                  <div className="glass-card p-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-4" style={sym}>sensors</span>
                    <p className="text-on-surface-variant font-code-sm text-code-sm">
                      Выбери ключевые слова и запусти сканирование прямых эфиров
                    </p>
                  </div>
                )}

                <AnimatePresence mode="popLayout">
                  {liveCards.map((card) => {
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
                          <div className="relative shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-surface-container-lowest border border-white/10">
                            {card.thumbnail ? (
                              <img src={card.thumbnail} alt="" className={`w-full h-full object-cover transition-all duration-500 ${isAnalyzing ? 'grayscale brightness-75' : ''}`} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl" style={sym}>{platformIcon[card.platform]}</span>
                              </div>
                            )}
                            {isAnalyzing && (
                              <>
                                <div className="scan-beam-grid" />
                                <div className="scan-beam" />
                                <span className="absolute top-0.5 left-1 z-10 font-code-sm text-[8px] tracking-widest text-primary animate-pulse">СКАН</span>
                              </>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 text-center py-0.5 font-label-caps text-[9px] tracking-widest z-10" style={{ background: `${platformColor[card.platform]}cc` }}>
                              {card.platform.toUpperCase()}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-on-surface truncate">{card.title || '—'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-on-surface-variant/60">@{card.username}</span>
                                  {card.viewCount > 0 && <span className="text-xs text-on-surface-variant/40 font-code-sm">{formatViews(card.viewCount)} просм.</span>}
                                </div>
                                <span className="text-[10px] font-code-sm text-on-surface-variant/30 mt-0.5 block">запрос: {card.keyword}</span>
                              </div>
                              <div className="shrink-0 text-right">
                                {isAnalyzing ? (
                                  <div className="flex items-center gap-1.5 text-primary">
                                    <span className="material-symbols-outlined text-sm animate-spin" style={sym}>progress_activity</span>
                                    <span className="text-xs font-code-sm">Claude…</span>
                                  </div>
                                ) : colors ? (
                                  <div className="verdict-stamp">
                                    <div className={`num-display text-2xl ${colors.text}`}>{card.riskScore}<span className="text-xs text-on-surface-variant">/100</span></div>
                                    <div className={`text-xs font-label-caps tracking-widest ${colors.text}`}>{getCategoryLabel(card.category!)}</div>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {!isAnalyzing && (card.detectedMarkers ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(card.detectedMarkers ?? []).slice(0, 3).map((m) => (
                                  <span key={m} className="text-[10px] px-1.5 py-0.5 rounded border border-error/25 text-error/80 bg-error-container/10 font-code-sm">{m}</span>
                                ))}
                                {(card.detectedMarkers ?? []).length > 3 && <span className="text-[10px] text-on-surface-variant/40">+{(card.detectedMarkers ?? []).length - 3}</span>}
                              </div>
                            )}
                            {!isAnalyzing && card.explanation && (
                              <p className="text-[11px] text-on-surface-variant/70 mt-2 font-code-sm leading-relaxed">
                                <Typewriter text={card.explanation.slice(0, 160)} />
                              </p>
                            )}
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

                {liveScanState === 'scanning' && liveCards.length > 0 && (
                  <div className="text-center py-4">
                    <span className="text-xs text-on-surface-variant/40 font-code-sm animate-pulse">Сканирование продолжается…</span>
                  </div>
                )}
              </>
            )}

            {/* ── Deep scan feed ── */}
            {mode === 'deep' && (
              <>
                {deepCards.length === 0 && deepScanState === 'idle' && (
                  <div className="glass-card p-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-4" style={sym}>find_in_page</span>
                    <p className="text-on-surface-variant font-code-sm text-sm mb-2">
                      Глубокий анализ длинных видео
                    </p>
                    <p className="text-on-surface-variant/50 font-code-sm text-xs leading-relaxed max-w-xs mx-auto">
                      Whisper транскрибирует аудио и находит мошенничество с точным временем — даже если обман в середине 30-минутного видео
                    </p>
                  </div>
                )}

                <AnimatePresence mode="popLayout">
                  {deepCards.map((card) => (
                    <DeepScanCard key={card.id} card={card} />
                  ))}
                </AnimatePresence>

                {deepScanState === 'scanning' && deepCards.length > 0 && (
                  <div className="text-center py-4">
                    <span className="text-xs text-on-surface-variant/40 font-code-sm animate-pulse">
                      Транскрибирование и анализ продолжается…
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
