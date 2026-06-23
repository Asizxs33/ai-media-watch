import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import type { AnalystTone } from '../store/useAppStore';

const sym = { fontVariationSettings: "'FILL' 0" };
const symFill = { fontVariationSettings: "'FILL' 1" };

const toneMeta: Record<AnalystTone, { color: string; icon: string }> = {
  safe:   { color: '#46e08a', icon: 'check_circle' },
  warn:   { color: '#ffb020', icon: 'error' },
  threat: { color: '#ff5640', icon: 'gpp_bad' },
  info:   { color: '#8b6dff', icon: 'info' },
};

/* Печатает текст по буквам */
function Typewriter({ text, speed = 14 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <>{text.slice(0, n)}{n < text.length && <span className="text-primary">▋</span>}</>;
}

export function AnalystDock() {
  const analyst = useAppStore((s) => s.analyst);
  const [open, setOpen] = useState(true);
  const [seen, setSeen] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // автоскролл вниз к новым сообщениям
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (open) setSeen(analyst.length);
  }, [analyst, open]);

  const unread = analyst.length - seen;
  const latestId = analyst.length ? analyst[analyst.length - 1].id : null;

  return (
    <div className="fixed right-4 bottom-24 md:bottom-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="mb-3 w-[88vw] max-w-[360px] bento p-0 overflow-hidden"
            style={{ boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-surface-container-low">
              <div className="relative w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 status-led text-on-primary">
                <span className="material-symbols-outlined text-lg" style={symFill}>shield_person</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="num-display text-sm text-on-surface leading-tight">AI-Аналитик</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                  <span className="font-code-sm text-[10px] text-on-surface-variant uppercase tracking-widest">на связи</span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                aria-label="Свернуть"
              >
                <span className="material-symbols-outlined text-xl" style={sym}>close_fullscreen</span>
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="max-h-[44vh] md:max-h-80 overflow-y-auto p-3 space-y-2">
              {analyst.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 block mb-2" style={sym}>radar</span>
                  <p className="text-xs text-on-surface-variant/60 font-code-sm leading-relaxed">
                    Жду задачу на сканирование. Запусти Live Сканер или проверь URL — буду комментировать находки вживую.
                  </p>
                </div>
              ) : (
                analyst.map((m) => {
                  const meta = toneMeta[m.tone];
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-xl px-3 py-2.5 bg-white/[0.03] border-l-2"
                      style={{ borderColor: meta.color }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-sm shrink-0 mt-0.5" style={{ ...sym, color: meta.color }}>
                          {meta.icon}
                        </span>
                        <p className="text-[13px] text-on-surface leading-snug">
                          {m.id === latestId ? <Typewriter text={m.text} /> : m.text}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating bubble (toggle) */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.92 }}
        className="relative w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-[0_12px_40px_-8px_rgba(206,255,26,0.5)] status-led"
        aria-label="AI-аналитик"
      >
        <span className="material-symbols-outlined text-2xl" style={symFill}>shield_person</span>
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-error text-white text-[11px] font-bold flex items-center justify-center num-display">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </motion.button>
    </div>
  );
}
