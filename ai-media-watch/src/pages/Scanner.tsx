import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { getRiskColor, getCategoryLabel } from '../components/ui/RiskBadge';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { composeAnalystComment } from '../utils/analyst';
import { detectRegion } from '../utils/region';
import { BACKEND } from '../config';
import type { Post, Platform } from '../types';

const sym = { fontVariationSettings: "'FILL' 0" };

interface LogEntry { text: string; type: 'process' | 'success' | 'error' | 'warning' }
interface RealResult {
  category: 'safe' | 'casino' | 'pyramid' | 'fraud';
  riskScore: number;
  confidence: number;
  detectedMarkers: string[];
  explanation: string;
  legalReference?: string;
  transcript?: string;
  scrapedText?: string;
  platform?: string;
}

const logColors: Record<string, string> = {
  process: 'text-on-surface-variant',
  warning: 'text-warning',
  error:   'text-error',
  success: 'text-tertiary',
};

function extractUsername(url: string): string {
  const m = url.match(/@([\w.]+)/);
  return m?.[1] ?? '';
}

export default function Scanner() {
  const addPost = useAppStore((s) => s.addPost);
  const pushAnalyst = useAppStore((s) => s.pushAnalyst);

  const [inputMode, setInputMode]         = useState<'url' | 'text' | 'image'>('url');
  const [urlInput, setUrlInput]           = useState('');
  const [textInput, setTextInput]         = useState('');
  const [imageData, setImageData]         = useState('');   // data:-URL для превью и отправки
  const [imageName, setImageName]         = useState('');
  const [dragOver, setDragOver]           = useState(false);
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [platformInput, setPlatformInput] = useState('tiktok');
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState<RealResult | null>(null);
  const [error, setError]                 = useState('');
  const [logs, setLogs]                   = useState<LogEntry[]>([]);
  const [backendOk, setBackendOk]         = useState<boolean | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/health`)
      .then(r => r.json())
      .then(d => setBackendOk(d.status === 'ok'))
      .catch(() => setBackendOk(false));
  }, []);

  const onFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Нужен файл изображения'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Изображение больше 10 МБ'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImageData(reader.result as string); setImageName(file.name); setError(''); };
    reader.readAsDataURL(file);
  };

  const addLog = (text: string, type: LogEntry['type'] = 'process') => {
    setLogs(prev => [...prev, { text, type }]);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 30);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    setError('');
    setLogs([]);

    try {
      let data: any;

      if (inputMode === 'url') {
        if (!urlInput.trim()) { setError('Введи URL'); setLoading(false); return; }
        addLog(`> Анализ: ${urlInput}`, 'process');
        addLog('> Скрапинг страницы...', 'process');

        const res = await fetch(`${BACKEND}/api/analyze/url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput.trim() }),
        });
        data = await res.json();
        if (!data.success) throw new Error(data.error);

        addLog('> Страница получена ✓', 'success');
        if (data.transcript) addLog('> Whisper транскрипция ✓', 'success');
        addLog('> Claude API: классификация...', 'process');

      } else if (inputMode === 'image') {
        if (!imageData) { setError('Прикрепи скриншот'); setLoading(false); return; }
        addLog('> Claude Vision: читаю изображение...', 'process');
        addLog('> OCR + извлечение реквизитов...', 'process');

        const res = await fetch(`${BACKEND}/api/analyze/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: imageData }),
        });
        data = await res.json();
        if (!data.success) throw new Error(data.error);

        addLog('> Текст с картинки распознан ✓', 'success');
        addLog('> Claude API: классификация...', 'process');

      } else {
        if (!textInput.trim()) { setError('Введи текст поста'); setLoading(false); return; }
        addLog('> Отправка текста в Claude API...', 'process');

        const hashtags = hashtagsInput.split(/[\s,]+/).filter(Boolean);
        const res = await fetch(`${BACKEND}/api/analyze/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: textInput.trim(), hashtags, platform: platformInput }),
        });
        data = await res.json();
        if (!data.success) throw new Error(data.error);
        addLog('> Claude API: ответ получен ✓', 'success');
      }

      addLog(`> Risk Score: ${data.riskScore}/100`, data.riskScore >= 60 ? 'error' : 'success');
      addLog(`> Категория: ${getCategoryLabel(data.category)}`, data.riskScore >= 60 ? 'error' : 'success');
      setResult(data);

      // Сохраняем в дашборд
      const platform = (data.platform ?? platformInput ?? 'tiktok') as Platform;
      const post: Post = {
        id: `real-${Date.now()}`,
        platform,
        username: inputMode === 'image'
          ? 'screenshot'
          : extractUsername(inputMode === 'url' ? urlInput : '') || 'unknown',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${Date.now()}`,
        caption: inputMode === 'url'
          ? (data.scrapedText?.slice(0, 200) || urlInput)
          : inputMode === 'image'
          ? (data.ocrText?.slice(0, 200) || 'Скриншот')
          : textInput.slice(0, 200),
        hashtags: hashtagsInput.split(/[\s,]+/).filter(Boolean),
        thumbnailColor: '#1c1f29',
        videoTranscript: data.transcript || '',
        ocrText: inputMode === 'image' ? (data.ocrText || '') : '',
        riskScore: data.riskScore,
        category: data.category,
        detectedMarkers: data.detectedMarkers || [],
        timestamp: new Date().toISOString(),
        status: 'pending',
        url: inputMode === 'url' ? urlInput.trim() : undefined,
        requisites: Array.isArray(data.requisites) ? data.requisites : [],
        region: detectRegion(inputMode === 'url' ? (data.scrapedText || urlInput) : textInput),
      };

      // AI-аналитик комментирует (кросс-ссылка на реестр до добавления)
      const comment = composeAnalystComment(
        { username: post.username, category: post.category, riskScore: post.riskScore, detectedMarkers: post.detectedMarkers, requisites: post.requisites },
        useAppStore.getState().posts
      );
      pushAnalyst(comment.text, comment.tone, post.id);

      addPost(post);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка сети';
      setError(msg);
      addLog(`> ОШИБКА: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-3xl">

        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {loading ? (
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ boxShadow: '0 0 15px rgba(206,255,26,0.5)' }} />
            ) : (
              <div className="absolute inset-0 rounded-full border border-primary/30" />
            )}
            <span className={`material-symbols-outlined text-2xl relative z-10 transition-colors text-primary ${loading ? 'animate-pulse' : ''}`} style={sym}>smart_toy</span>
          </div>
          <h1 className="num-display text-4xl md:text-5xl text-on-surface">Анализ контента</h1>
        </div>

        {/* Backend status */}
        <div className={`flex items-center gap-2 text-xs font-code-sm px-3 py-2 rounded-xl border mb-5 ${
          backendOk === null ? 'border-white/10 text-on-surface-variant' :
          backendOk          ? 'border-tertiary/30 text-tertiary bg-tertiary/5' :
                               'border-error/30 text-error bg-error-container/10'
        }`}>
          <span className="material-symbols-outlined text-sm" style={sym}>
            {backendOk === null ? 'sync' : backendOk ? 'check_circle' : 'error'}
          </span>
          {backendOk === null ? 'Проверка сервера...' :
           backendOk ? 'Бэкенд запущен — Claude API готов' :
           'Бэкенд не запущен. Запусти: cd backend && npm run dev'}
        </div>

        {/* Input form */}
        <div className="glass-card p-5 mb-4">
          <div className="flex gap-2 mb-5">
            {([['url', 'link', 'URL поста'], ['image', 'image', 'Скриншот'], ['text', 'edit_note', 'Текст вручную']] as const).map(([mode, icon, label]) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-label-caps text-label-caps tracking-widest text-xs transition-all border ${
                  inputMode === mode
                    ? 'border-white/25 text-white bg-white/10'
                    : 'border-white/10 text-on-surface-variant hover:border-white/20'
                }`}
              >
                <span className="material-symbols-outlined text-sm" style={sym}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {inputMode === 'url' ? (
            <div className="space-y-3">
              <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block">URL ПОСТА</label>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder="https://www.tiktok.com/@user/video/..."
                className="w-full bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary-container/40 font-code-sm"
              />
              <p className="text-xs text-on-surface-variant/50">
                TikTok, Instagram, YouTube — скрапит text + (если есть yt-dlp) транскрибирует аудио через Whisper
              </p>
            </div>
          ) : inputMode === 'image' ? (
            <div className="space-y-3">
              <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block">СКРИНШОТ</label>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0]); }}
                className={`relative block rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-white/15 hover:border-white/30'
                }`}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
                />
                {imageData ? (
                  <div className="flex items-center gap-4 p-3">
                    <img src={imageData} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-white/10 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-on-surface truncate">{imageName}</p>
                      <p className="text-xs text-on-surface-variant/60 mt-1">Нажми «Проанализировать» — Claude прочитает картинку</p>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setImageData(''); setImageName(''); }}
                        className="text-xs text-error mt-2 hover:underline"
                      >
                        Убрать
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2" style={sym}>add_photo_alternate</span>
                    <p className="text-sm text-on-surface">Перетащи скриншот сюда или нажми</p>
                    <p className="text-xs text-on-surface-variant/50 mt-1">PNG, JPG, WEBP — пост, сторис, чат, реклама</p>
                  </div>
                )}
              </label>
              <p className="text-xs text-on-surface-variant/50">
                Claude Vision распознаёт текст на картинке, извлекает реквизиты и классифицирует — URL не нужен
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-2">ПЛАТФОРМА</label>
                <select
                  value={platformInput}
                  onChange={e => setPlatformInput(e.target.value)}
                  className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface focus:outline-none"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-2">ТЕКСТ ПОСТА / CAPTION</label>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  rows={5}
                  placeholder="Вставь описание поста, транскрипт или любой текст для анализа..."
                  className="w-full bg-surface-container-lowest/60 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary-container/40 resize-none"
                />
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant tracking-widest block mb-2">ХЭШТЕГИ (через пробел)</label>
                <input
                  type="text"
                  value={hashtagsInput}
                  onChange={e => setHashtagsInput(e.target.value)}
                  placeholder="#казино #выигрыш #заработок"
                  className="w-full bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary-container/40 font-code-sm"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !backendOk}
            className="mt-5 w-full btn-cyber-skew-primary justify-center py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            <span>
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin" style={sym}>progress_activity</span>
                  Анализирую...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm" style={sym}>smart_toy</span>
                  Проанализировать через Claude
                </>
              )}
            </span>
          </button>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-xs text-error bg-error-container/20 border border-error/20 rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-sm shrink-0" style={sym}>error</span>
              {error}
            </div>
          )}
        </div>

        {/* Log terminal */}
        <AnimatePresence>
          {logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card overflow-hidden p-0 mb-4"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-surface-container-lowest/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-error/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-tertiary/60" />
                </div>
                <span className="text-xs text-on-surface-variant font-code-sm ml-2">claude-analysis.log</span>
              </div>
              <div ref={logRef} className="p-4 font-code-sm text-code-sm space-y-1.5 bg-surface-container-lowest/40 max-h-44 overflow-y-auto relative">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(206,255,26,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />
                {logs.map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className={`${logColors[line.type]} relative z-10`}>
                    {line.text}
                  </motion.div>
                ))}
                {loading && <span className="text-primary animate-pulse relative z-10 text-lg">█</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result card */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                className={`glass-card relative overflow-hidden card-materialize ${result.riskScore >= 60 ? 'threat-flash' : ''}`}
                style={{ borderLeft: `3px solid ${getRiskColor(result.riskScore).bar}` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.03] rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ color: getRiskColor(result.riskScore).bar }} />
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary-container" style={sym}>smart_toy</span>
                    <div>
                      <div className="font-label-caps text-label-caps text-secondary-container tracking-widest">CLAUDE AI — РЕЗУЛЬТАТ</div>
                      <div className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                        Уверенность: {result.confidence}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-code-sm text-3xl font-bold ${getRiskColor(result.riskScore).text}`}>
                      {result.riskScore}<span className="text-base text-on-surface-variant">/100</span>
                    </div>
                    <div className={`font-label-caps text-label-caps tracking-widest ${getRiskColor(result.riskScore).text}`}>
                      {getCategoryLabel(result.category)}
                    </div>
                  </div>
                </div>

                <div className="w-full bg-white/10 rounded-full h-2 mb-5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.riskScore}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-2 rounded-full"
                    style={{ backgroundColor: getRiskColor(result.riskScore).bar }}
                  />
                </div>

                {result.detectedMarkers.length > 0 && (
                  <div className="mb-4">
                    <div className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-2">ОБНАРУЖЕННЫЕ МАРКЕРЫ</div>
                    <div className="flex flex-wrap gap-2">
                      {result.detectedMarkers.map(m => (
                        <span key={m} className="text-xs px-2 py-1 rounded border border-error/30 text-error bg-error-container/10 font-code-sm">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-surface-container-lowest/60 rounded-xl p-4 border border-secondary-container/10 mb-4">
                  <div className="font-label-caps text-label-caps text-secondary-container tracking-widest mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" style={sym}>description</span>
                    ОБЪЯСНЕНИЕ CLAUDE
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{result.explanation}</p>
                </div>

                {result.legalReference && (
                  <div className="text-xs text-on-surface-variant font-code-sm border-t border-white/5 pt-3">
                    ⚖️ {result.legalReference}
                  </div>
                )}

                <div className="mt-4 text-xs text-on-surface-variant/40 font-code-sm border-t border-white/5 pt-3">
                  ✓ Результат сохранён в Дашборд
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SidebarLayout>
  );
}
