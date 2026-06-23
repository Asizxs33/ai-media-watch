import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import type { Post } from '../types';
import { getRiskColor, getCategoryLabel } from '../components/ui/RiskBadge';
import { SidebarLayout } from '../components/layout/SidebarLayout';

const sym = { fontVariationSettings: "'FILL' 0" };

const AI_EXPLANATIONS: Record<string, string> = {
  casino:
    'Видео содержит признаки рекламы нелицензированных азартных игр. Выявлены характерные паттерны: демонстрация крупных выигрышей, призыв к регистрации без верификации, использование реферальных промокодов. Подобный контент нарушает Закон РК "Об игорном бизнесе" и подлежит немедленной блокировке.',
  pyramid:
    'Обнаружены признаки финансовой пирамиды: обещание нереалистично высокой доходности, реферальная система набора участников, многоуровневая структура выплат. Деятельность квалифицируется по ст. 217 УК РК "Организация финансовой пирамиды".',
  fraud:
    'Видео содержит явные признаки мошеннической деятельности: сбор персональных данных, ложные обещания заработка, фиктивные розыгрыши с оплатой "доставки". Рекомендуется немедленная блокировка и передача материалов в ДКИБ КНБ РК.',
  safe:
    'Контент проверен и признан безопасным. Не выявлено признаков незаконной деятельности, мошенничества или рекламы запрещённых услуг. Пост соответствует требованиям законодательства РК.',
};

const WAVEFORM_BARS = Array.from({ length: 40 }, (_, i) => ({
  height: 10 + ((i * 37 + 13) % 60),
  duration: 1.2 + (i % 7) * 0.1,
}));

function AudioWaveform() {
  return (
    <div className="flex items-center gap-0.5 h-12 px-2">
      {WAVEFORM_BARS.map((b, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0.3 }}
          animate={{ scaleY: [0.3, 1, 0.3] }}
          transition={{ duration: b.duration, repeat: Infinity, delay: i * 0.04 }}
          style={{ height: b.height }}
          className="w-1 rounded-full bg-secondary-container flex-shrink-0 opacity-70"
        />
      ))}
    </div>
  );
}

function highlightFraudPhrases(text: string): React.ReactNode {
  const phrases = [
    'ГАРАНТИРОВАННЫЙ ДОХОД', 'гарантированный доход',
    'ГАРАНТИЯ', 'гарантия',
    '200%', '300%', '500%', '1000x',
    'БЕЗ ВЛОЖЕНИЙ', 'без вложений',
    'ПРИГЛАСИ 3 ДРУЗЕЙ', 'пригласи',
    'реферальн', 'РЕФЕРАЛЬН',
    'КАЗИНО', 'казино',
    'ВЫИГРАЙ', 'выиграй',
    'МАТРИЦА', 'матрица',
    'номер карты', 'НОМЕР КАРТЫ',
    'удостоверение', 'УДОСТОВЕРЕНИЕ',
  ];

  let result: (string | React.ReactElement)[] = [text];
  phrases.forEach((phrase) => {
    result = result.flatMap((node) => {
      if (typeof node !== 'string') return [node];
      const parts = node.split(new RegExp(`(${phrase})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === phrase.toLowerCase()
          ? <mark key={`${phrase}-${i}`} className="bg-error/30 text-error rounded px-0.5">{part}</mark>
          : part
      );
    });
  });
  return <>{result}</>;
}

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getTiktokId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

interface OcrBox { text: string; top: number; left: number; width: number }

function VideoEmbed({ post, ocrBoxes }: { post: Post; ocrBoxes: OcrBox[] }) {
  if (post.url) {
    if (post.platform === 'youtube') {
      const vid = getYoutubeId(post.url);
      if (vid) {
        return (
          <div className="rounded-2xl overflow-hidden border border-white/10" style={{ aspectRatio: '16/9' }}>
            <iframe
              src={`https://www.youtube.com/embed/${vid}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
    }
    if (post.platform === 'tiktok') {
      const vid = getTiktokId(post.url);
      if (vid) {
        return (
          <div className="flex justify-center">
            <div className="rounded-2xl overflow-hidden border border-white/10 w-48" style={{ aspectRatio: '9/16' }}>
              <iframe
                src={`https://www.tiktok.com/embed/v2/${vid}`}
                className="w-full h-full"
                allow="autoplay"
                allowFullScreen
              />
            </div>
          </div>
        );
      }
    }
  }

  // Fallback: colored thumbnail
  return (
    <div className="flex justify-center">
      <div
        className="relative w-48 rounded-2xl overflow-hidden border-2 border-white/10"
        style={{ aspectRatio: '9/16', background: post.thumbnailColor }}
      >
        <div className="absolute bottom-4 left-2 right-2">
          <p className="text-white text-xs font-semibold drop-shadow">@{post.username}</p>
          <p className="text-white/70 text-xs truncate">{post.caption.slice(0, 40)}...</p>
        </div>
        {ocrBoxes.map((box, i) => (
          <div
            key={i}
            className="absolute border border-secondary-container bg-secondary-container/10 rounded"
            style={{ top: `${box.top}%`, left: `${box.left}%`, width: `${box.width}%` }}
          >
            <span className="text-secondary-container text-[8px] font-code-sm px-0.5 leading-tight block truncate">
              {box.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const posts = useAppStore((s) => s.posts);
  const updateStatus = useAppStore((s) => s.updatePostStatus);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return (
      <SidebarLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-on-surface-variant">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl mb-4 block opacity-40" style={sym}>search</span>
            <p className="font-code-sm text-code-sm">Пост не найден</p>
            <Link to="/scanner" className="text-secondary-container hover:underline mt-2 inline-block text-sm">
              ← Назад
            </Link>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const colors = getRiskColor(post.riskScore);
  const explanation = AI_EXPLANATIONS[post.category];
  const radialData = [{ name: 'Risk', value: post.riskScore, fill: colors.bar }];

  const ocrBoxes = post.ocrText
    ? post.ocrText.split('\n').filter(Boolean).map((line, i) => ({
        text: line,
        top: 20 + i * 22,
        left: 8,
        width: 84,
      }))
    : [];

  const isHighRisk = post.riskScore >= 70;

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-6xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant mb-6">
          <Link to="/scanner" className="hover:text-secondary-container transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" style={sym}>arrow_back</span>
            Сканер
          </Link>
          <span>/</span>
          <span className="text-on-surface">@{post.username}</span>
        </div>

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card mb-6 flex flex-wrap items-center justify-between gap-4"
          style={isHighRisk ? { borderLeft: '4px solid #FF4757' } : undefined}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={post.avatar} className="w-16 h-16 rounded-full border border-white/20" alt={post.username} />
              {isHighRisk && (
                <div className="absolute -bottom-2 -right-2 bg-error-container text-on-error-container font-label-caps text-[10px] px-1.5 py-0.5 rounded strobe-pulse">
                  РИСК
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-headline-md text-lg font-semibold text-on-surface">@{post.username}</span>
                <span className="font-label-caps text-label-caps text-on-surface-variant/60 uppercase tracking-widest">
                  {post.platform}
                </span>
              </div>
              <p className="font-code-sm text-code-sm text-on-surface-variant">
                {new Date(post.timestamp).toLocaleString('ru-RU')}
                {post.views && ` · ${(post.views / 1000).toFixed(0)}K просмотров`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`font-code-sm text-3xl font-bold ${colors.text}`}>{post.riskScore}</div>
            <div>
              <div className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">/ 100</div>
              <div className={`font-label-caps text-label-caps tracking-widest ${colors.text}`}>
                {getCategoryLabel(post.category)}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Two columns */}
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Video embed */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  Видео
                </h3>
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-code-sm text-code-sm text-secondary-container hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm" style={sym}>open_in_new</span>
                    Открыть
                  </a>
                )}
              </div>
              <VideoEmbed post={post} ocrBoxes={ocrBoxes} />
            </div>

            {/* Transcript */}
            {post.videoTranscript && (
              <div className="glass-card">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-3 tracking-widest">
                  Транскрипт аудио
                </h3>
                <div className="bg-surface-container-lowest/60 rounded-xl p-3 font-code-sm text-code-sm text-on-surface-variant leading-relaxed max-h-36 overflow-y-auto border border-white/5 relative shimmer group-hover:border-white/10 transition-colors">
                  {highlightFraudPhrases(post.videoTranscript)}
                </div>
                {post.ocrText && (
                  <>
                    <h4 className="font-label-caps text-label-caps text-on-surface-variant mt-3 mb-2 tracking-widest">
                      OCR — текст на экране
                    </h4>
                    <div className="bg-surface-container-lowest/60 rounded-xl p-3 font-code-sm text-code-sm text-secondary-container leading-relaxed border border-secondary-container/10">
                      {highlightFraudPhrases(post.ocrText)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Audio waveform */}
            <div className="glass-card">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-2 tracking-widest">
                Аудиодорожка
              </h3>
              <AudioWaveform />
              <div className="flex justify-between font-code-sm text-[10px] text-on-surface-variant mt-1 px-2">
                <span>0:00</span>
                <span>{post.riskScore > 50 ? '⚠ Риск-фразы обнаружены' : '✓ Анализ завершён'}</span>
                <span>0:47</span>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            {/* Radial risk gauge */}
            <div className="glass-card relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-current opacity-[0.04] rounded-full blur-3xl transform translate-x-1/4 -translate-y-1/4 pointer-events-none" style={{ color: colors.bar }} />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  Уровень риска
                </h3>
                <span className={`font-code-sm text-2xl font-bold ${colors.text}`}>
                  {post.riskScore}/100
                </span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart
                  cx="50%" cy="80%"
                  innerRadius="60%" outerRadius="90%"
                  startAngle={180} endAngle={0}
                  data={radialData}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-6">
                <span className={`font-label-caps text-label-caps font-semibold tracking-widest ${colors.text}`}>
                  {getCategoryLabel(post.category)}
                </span>
              </div>
            </div>

            {/* Detected markers */}
            {post.detectedMarkers.length > 0 && (
              <div
                className="glass-card neon-pulse-border"
                style={{ borderLeft: `2px solid ${isHighRisk ? '#FF4757' : '#FFB830'}`, boxShadow: `0 0 20px ${isHighRisk ? 'rgba(255,71,87,0.1)' : 'rgba(255,184,48,0.1)'}` }}
              >
                <h3 className="font-label-caps text-label-caps text-on-surface mb-3 tracking-widest flex items-center gap-2">
                  <span className={`material-symbols-outlined text-sm ${isHighRisk ? 'text-error animate-pulse' : 'text-warning'}`} style={sym}>flag</span>
                  Обнаружены маркеры
                </h3>
                <ul className="space-y-2">
                  {post.detectedMarkers.map((m) => (
                    <li key={m} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <span className="text-error mt-0.5">▸</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI explanation */}
            <div className="glass-card border-l-2 border-l-secondary-container">
              <h3 className="font-label-caps text-label-caps text-on-surface mb-3 tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-container text-sm" style={sym}>smart_toy</span>
                Объяснение ИИ
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{explanation}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => updateStatus(post.id, 'blocked')}
                className="btn-cyber-skew flex-1 py-3 text-sm border-error/30 text-error hover:bg-error-container/20 hover:border-error"
              >
                <span>
                  <span className="material-symbols-outlined text-sm" style={sym}>policy</span>
                  На проверку
                </span>
              </button>
              <button
                onClick={() => updateStatus(post.id, 'reviewed')}
                className="btn-cyber-skew flex-1 py-3 text-sm border-tertiary/30 text-tertiary hover:bg-tertiary/10 hover:border-tertiary"
              >
                <span>
                  <span className="material-symbols-outlined text-sm" style={sym}>check_circle</span>
                  Безопасно
                </span>
              </button>
            </div>

            {/* Metadata */}
            <div className="glass-card">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-3 tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={sym}>terminal</span>
                METADATA
              </h3>
              <ul className="space-y-2 font-code-sm text-code-sm">
                {[
                  ['ID', post.id],
                  ['Платформа', post.platform],
                  ['Статус', post.status],
                  ['Хэштеги', post.hashtags.slice(0, 3).map(h => `#${h}`).join(' ')],
                  ['Просмотры', post.views?.toLocaleString() ?? '—'],
                  ...(post.url ? [['URL', post.url]] : []),
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="text-on-surface-variant">{k}</span>
                    <span className="text-on-surface text-right truncate max-w-[60%]">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
