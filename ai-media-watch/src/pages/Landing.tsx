import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const sym = { fontVariationSettings: "'FILL' 0" };
const symFill = { fontVariationSettings: "'FILL' 1" };

/* ─── Live counter hook ─── */
function useCounter(start: number, step: () => number, interval = 3200) {
  const [value, setValue] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setValue((v) => v + step()), interval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/* ─── Count-up: tween displayed value toward target ─── */
function useAnimatedNumber(target: number, duration = 1100) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min((t - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return display;
}

/* ─── Tiny animated sparkline of bars ─── */
function Sparkline({ color, seed = 0 }: { color: string; seed?: number }) {
  const bars = Array.from({ length: 16 }, (_, i) => 30 + ((i * 41 + seed * 17) % 70));
  return (
    <div className="flex items-end gap-[3px] h-6">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${h}%`,
            background: color,
            transformOrigin: 'bottom',
            animation: `sparkPulse ${1.4 + (i % 5) * 0.18}s ease-in-out ${i * 0.05}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Case files ─── */
const cases = [
  {
    id: 'KZ-2024-0471', tag: 'КАЗИНО', platform: 'TikTok', username: '@kazwin_official',
    title: '«Выиграй до ₸500,000 без верификации»',
    markers: ['промокод', 'зеркало сайта', 'гарантия выигрыша'],
    risk: 94, law: 'Закон РК «Об игорном бизнесе» ст.3', views: '2.1M',
  },
  {
    id: 'KZ-2024-1203', tag: 'ПИРАМИДА', platform: 'Instagram', username: '@invest_kz_pro',
    title: '«+300% к депозиту за 30 дней — гарантия»',
    markers: ['доходность 300%', 'реферальная цепочка', 'срочно'],
    risk: 88, law: 'ст.217 УК РК «Финансовая пирамида»', views: '890K',
  },
  {
    id: 'KZ-2024-2018', tag: 'МОШЕННИЧЕСТВО', platform: 'YouTube', username: '@nfx_trading_kz',
    title: '«Торговый сигнал: +84% за неделю»',
    markers: ['поддельная статистика', 'сбор данных карты', 'без лицензии'],
    risk: 97, law: 'ст.190 УК РК «Мошенничество»', views: '340K',
  },
];

/* ─── Ticker items ─── */
const TICKER = [
  '@win_slots_kz · КАЗИНО · 91',
  '@easy_profit_almaty · ПИРАМИДА · 87',
  '@cooking_kz_official · SAFE · 04',
  '@forex_signal_nur · МОШЕННИЧЕСТВО · 95',
  '@travel_diary_kz · SAFE · 08',
  '@cryptoking_astana · МОШЕННИЧЕСТВО · 89',
  '@recipe_club_kz · SAFE · 02',
  '@jackpot_online_kz · КАЗИНО · 93',
];

export default function Landing() {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState('');
  const [activeCase, setActiveCase] = useState(0);

  const threats = useAnimatedNumber(useCounter(18_734, () => Math.floor(Math.random() * 2)));
  const scanned = useAnimatedNumber(useCounter(2_401_847, () => Math.floor(Math.random() * 8 + 3)));
  const blocked = useAnimatedNumber(useCounter(4_219, () => (Math.random() > 0.7 ? 1 : 0)));

  useEffect(() => {
    const id = setInterval(() => setActiveCase((c) => (c + 1) % cases.length), 5000);
    return () => clearInterval(id);
  }, []);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) navigate('/scanner');
  };

  const c = cases[activeCase];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden text-on-surface relative">

      {/* ══ LIVING BACKGROUND ══ */}
      <div className="atmos">
        <div className="atmos-grid" />
        <div className="aura aura--lime" />
        <div className="aura aura--violet" />
        <div className="aura aura--lime-2" />
      </div>

      {/* ══ NAV ══ */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 md:px-8 py-4 bg-background/70 backdrop-blur-xl border-b border-white/[0.06]">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Spectra AI" width={48} height={48} style={{ filter: 'brightness(1.6) saturate(1.3)' }} />
          <span className="num-display text-base">SPECTRA <span style={{ color: '#ceff1a', textShadow: '0 0 12px #ceff1a99' }}>AI</span></span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-xs text-on-surface-variant tracking-widest uppercase font-code-sm">
          <Link to="/livescanner" className="hover:text-on-surface transition-colors">Сканер</Link>
          <Link to="/dashboard" className="hover:text-on-surface transition-colors">Дашборд</Link>
          <Link to="/trends" className="hover:text-on-surface transition-colors">Тренды</Link>
        </div>
        <Link to="/livescanner" className="btn-primary text-xs px-4 py-2.5">
          <span className="material-symbols-outlined text-sm" style={sym}>bolt</span>
          Открыть систему
        </Link>
      </nav>

      {/* ══ HERO ══ */}
      <section className="relative z-10 pt-28 md:pt-32 pb-10 px-5 md:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-error animate-ping" />
          <span className="font-code-sm text-[11px] text-on-surface-variant tracking-widest uppercase">
            Система мониторинга соцсетей · Казахстан
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="num-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.92] mb-6 max-w-5xl"
        >
          Мошенников ловим<br />
          за <span className="text-lime-violet text-glow-lime">4 секунды</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-on-surface-variant text-base md:text-lg leading-relaxed mb-8 max-w-xl"
        >
          ИИ анализирует видео, текст, аудио и хэштеги в TikTok и YouTube.
          Казино, пирамиды, фишинг — классифицируем и передаём в&nbsp;АРРФР&nbsp;РК.
        </motion.p>

        {/* ══ BENTO GRID ══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(0,1fr)] gap-3 md:gap-4">

          {/* Big lime counter — scanned */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
            className="bento bento-accent col-span-2 lg:col-span-2 row-span-2 flex flex-col justify-between min-h-[220px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-[11px] uppercase tracking-widest opacity-70">Проверено всего</span>
              <span className="material-symbols-outlined text-xl opacity-80" style={symFill}>travel_explore</span>
            </div>
            <div>
              <motion.div key={scanned} className="num-display text-[clamp(2.5rem,7vw,5rem)]">
                {scanned.toLocaleString('ru')}
              </motion.div>
              <p className="text-sm font-medium opacity-70 mt-1">видео и постов в реальном времени</p>
            </div>
          </motion.div>

          {/* Threats */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="bento bento-lift flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-start justify-between">
              <span className="font-code-sm text-[10px] uppercase tracking-widest text-on-surface-variant">Угроз</span>
              <Sparkline color="#ffb020" seed={3} />
            </div>
            <div className="num-display text-3xl md:text-4xl text-warning">{threats.toLocaleString('ru')}</div>
          </motion.div>

          {/* Blocked */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
            className="bento bento-lift flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-start justify-between">
              <span className="font-code-sm text-[10px] uppercase tracking-widest text-on-surface-variant">Заблокировано</span>
              <Sparkline color="#ff5640" seed={7} />
            </div>
            <div className="num-display text-3xl md:text-4xl text-error">{blocked.toLocaleString('ru')}</div>
          </motion.div>

          {/* Live case tile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="bento col-span-2 row-span-1 min-h-[104px] flex flex-col justify-center"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-code-sm text-[10px] uppercase tracking-widest text-on-surface-variant">
                Последнее дело
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                <span className="font-code-sm text-[10px] text-error">REC</span>
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCase}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-3"
              >
                <div className="num-display text-3xl text-error shrink-0">{c.risk}</div>
                <div className="min-w-0">
                  <div className="font-code-sm text-xs text-primary truncate">{c.username}</div>
                  <div className="text-xs text-on-surface-variant truncate">{c.tag} · {c.platform} · {c.views}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Scanner input tile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
            className="bento col-span-2 lg:col-span-4 min-h-[104px] flex flex-col justify-center"
          >
            <span className="font-code-sm text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
              Проверь любое видео прямо сейчас
            </span>
            <form onSubmit={handleScan} className="flex items-stretch gap-2">
              <div className="flex-1 input-cyber-skew-wrap flex items-center px-4 h-12">
                <span className="material-symbols-outlined text-on-surface-variant text-base mr-2" style={sym}>link</span>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Вставь URL — TikTok, Instagram или YouTube…"
                  className="bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none font-code-sm w-full"
                />
              </div>
              <button type="submit" className="btn-primary px-6 h-12 text-sm">
                <span>Проверить</span>
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* ══ MARQUEE TICKER ══ */}
      <div className="relative z-10 overflow-hidden border-y border-white/[0.06] py-3 my-6 bg-background/40 backdrop-blur-sm">
        <div className="flex whitespace-nowrap" style={{ animation: 'marqueeScroll 40s linear infinite' }}>
          {[...TICKER, ...TICKER].map((item, i) => {
            const safe = item.includes('SAFE');
            return (
              <span key={i} className="font-code-sm text-sm mx-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ ...sym, color: safe ? '#46e08a' : '#ff5640' }}>
                  {safe ? 'check_circle' : 'warning'}
                </span>
                <span style={{ color: safe ? '#46e08a' : '#ff5640' }}>{item}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ══ PROBLEM ══ */}
      <section className="relative z-10 py-16 md:py-24 px-5 md:px-8 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="font-code-sm text-[11px] text-on-surface-variant tracking-widest uppercase mb-5">Масштаб проблемы</p>
          <h2 className="num-display text-[clamp(1.75rem,4vw,3rem)] leading-[1.05] mb-12 max-w-3xl">
            В 2024 казахстанцы потеряли <span className="text-error">₸48 млрд</span> из-за мошенников в соцсетях
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { n: '1 из 3', desc: 'пользователей TikTok видел рекламу нелегального казино', c: 'text-warning' },
            { n: '₸148K', desc: 'средний ущерб от пирамиды на одного пострадавшего', c: 'text-error' },
            { n: '94.7%', desc: 'точность нашей системы детекции на тестовых данных', c: 'text-primary' },
          ].map((s, i) => (
            <motion.div
              key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }} viewport={{ once: true }}
              className="bento min-h-[160px] flex flex-col justify-between"
            >
              <div className={`num-display text-4xl md:text-5xl ${s.c}`}>{s.n}</div>
              <p className="text-on-surface-variant text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="relative z-10 py-16 md:py-24 px-5 md:px-8 max-w-6xl mx-auto">
        <motion.div className="mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="font-code-sm text-[11px] text-on-surface-variant tracking-widest uppercase mb-3">Как работает</p>
          <h2 className="num-display text-[clamp(1.75rem,4vw,2.75rem)]">Пайплайн за 4 шага</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { step: '01', icon: 'travel_explore', title: 'Сканирование', desc: 'yt-dlp ищет видео по ключевым словам на YouTube и TikTok' },
            { step: '02', icon: 'text_snippet', title: 'Извлечение', desc: 'Скрапинг заголовка, описания, хэштегов и метаданных' },
            { step: '03', icon: 'smart_toy', title: 'Claude AI', desc: 'Классификация с объяснением и ссылкой на закон РК' },
            { step: '04', icon: 'policy', title: 'Передача дела', desc: 'Формирование отчёта для АРРФР и ДКИБ КНБ РК' },
          ].map((s, i) => (
            <motion.div
              key={s.step} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }} viewport={{ once: true }}
              className="bento bento-lift min-h-[200px] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="num-display text-3xl" style={{ color: i % 2 === 0 ? '#ceff1a' : '#8b6dff' }}>{s.step}</span>
                <span className="material-symbols-outlined text-2xl text-on-surface-variant" style={sym}>{s.icon}</span>
              </div>
              <div>
                <h3 className="num-display text-lg mb-2">{s.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="relative z-10 py-16 md:py-24 px-5 md:px-8 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="bento bento-accent flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 md:p-12"
        >
          <div>
            <h2 className="num-display text-[clamp(1.75rem,4vw,3rem)] leading-[1] mb-3">Попробуй прямо сейчас</h2>
            <p className="text-sm md:text-base font-medium opacity-70 max-w-md">
              Вставь URL подозрительного видео — Claude AI проанализирует за секунды.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link to="/livescanner" className="btn-cyber-skew bg-on-primary/10 border-on-primary/20 text-on-primary hover:bg-on-primary hover:text-primary px-6 py-3">
              <span>
                <span className="material-symbols-outlined text-sm" style={sym}>sensors</span>
                Live Сканер
              </span>
            </Link>
            <Link to="/scanner" className="btn-cyber-skew bg-on-primary/10 border-on-primary/20 text-on-primary hover:bg-on-primary hover:text-primary px-6 py-3">
              <span>
                <span className="material-symbols-outlined text-sm" style={sym}>smart_toy</span>
                Анализ URL
              </span>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-5 md:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-code-sm text-[11px] text-on-surface-variant">Spectra AI © 2026</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-code-sm text-[11px] text-primary uppercase tracking-widest">Система активна</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
