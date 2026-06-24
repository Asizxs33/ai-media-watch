import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { useAppStore } from '../store/useAppStore';
import { RiskBadge, getCategoryLabel } from '../components/ui/RiskBadge';
import { KazakhstanMap } from '../components/KazakhstanMap';
import type { Region, Category } from '../types';

// Coordinates for Kazakhstan cities/regions (in SVG viewBox 800x480)
interface RegionNode {
  id: Region;
  label: string;
  x: number;
  y: number;
  info: string;
}

const REGION_NODES: RegionNode[] = [
  { id: 'astana', label: 'Астана', x: 480, y: 150, info: 'Центральный хаб мониторинга правонарушений РК.' },
  { id: 'almaty', label: 'Алматы', x: 620, y: 370, info: 'Крупный очаг спам-активностей и фейковых розыгрышей.' },
  { id: 'shymkent', label: 'Шымкент', x: 430, y: 380, info: 'Повышенный уровень спама с рекламой серых казино.' },
  { id: 'west', label: 'Западный КЗ', x: 180, y: 220, info: 'Активность в Телеграм-каналах по легким заработкам (Атырау/Актау).' },
  { id: 'east', label: 'Восточный КЗ', x: 700, y: 190, info: 'Схемы инвестиционных сигналов (Усть-Каменогорск/Семей).' },
  { id: 'north', label: 'Северный КЗ', x: 380, y: 90, info: 'Финансовые боты и реферальные схемы MLM (Костанай/Петропавловск).' },
  { id: 'center', label: 'Центральный КЗ', x: 530, y: 220, info: 'Фальшивые объявления о трудоустройстве (Караганда).' },
];

const sym = { fontVariationSettings: "'FILL' 0" };
const symFill = { fontVariationSettings: "'FILL' 1" };

export default function CommandCenter() {
  const posts = useAppStore((s) => s.posts);
  const [selectedRegion, setSelectedRegion] = useState<Region | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  
  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  
  // CLI State
  const [cliInput, setCliInput] = useState('');
  const [cliLogs, setCliLogs] = useState<string[]>([
    'SYSTEM: Spectra AI CommandCenter initialized.',
    'SYSTEM: Enter "help" to view CLI commands.',
    'SYSTEM: Click Microphone to use Voice Controls.'
  ]);
  const cliScrollRef = useRef<HTMLDivElement>(null);
  
  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);

  // Auto Scroll CLI
  useEffect(() => {
    if (cliScrollRef.current) {
      cliScrollRef.current.scrollTop = cliScrollRef.current.scrollHeight;
    }
  }, [cliLogs]);

  // Voice Speech Synthesis
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'ru-RU';

      rec.onstart = () => {
        setIsListening(true);
        setSpokenText('Слушаю...');
      };

      rec.onerror = (e: any) => {
        console.error('Speech error', e);
        setIsListening(false);
        setCliLogs((prev) => [...prev, `VOICE_ERROR: Не удалось распознать речь (${e.error})`]);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript.toLowerCase().trim();
        setSpokenText(text);
        setCliLogs((prev) => [...prev, `VOICE_IN > "${text}"`]);
        handleVoiceCommand(text);
      };

      recognitionRef.current = rec;
    }

    // Welcome voice notification
    setTimeout(() => {
      speak('Командный центр кибербезопасности активирован. Карта угроз Казахстана запущена. Готова к голосовым командам.');
    }, 1000);

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    const regionMatch = selectedRegion === 'all' || p.region === selectedRegion;
    const catMatch = categoryFilter === 'all' || p.category === categoryFilter;
    return regionMatch && catMatch;
  });

  // Calculate region stats
  const getRegionStats = (regId: Region) => {
    const regPosts = posts.filter((p) => p.region === regId);
    const threats = regPosts.filter((p) => p.category !== 'safe');
    const avgRisk = regPosts.length 
      ? Math.round(regPosts.reduce((sum, p) => sum + p.riskScore, 0) / regPosts.length)
      : 0;

    return {
      count: regPosts.length,
      threatCount: threats.length,
      avgRisk,
    };
  };

  // Toggle Voice Listening
  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      setCliLogs((prev) => [...prev, 'SYSTEM: Голосовое управление не поддерживается вашим браузером. Используйте CLI.']);
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Voice commands parser
  const handleVoiceCommand = (command: string) => {
    if (command.includes('казино')) {
      setCategoryFilter('casino');
      speak('Показываю нелегальные казино на карте.');
      setCliLogs((prev) => [...prev, 'SYSTEM: Фильтр: Казино']);
    } else if (command.includes('пирамид') || command.includes('млм')) {
      setCategoryFilter('pyramid');
      speak('Фильтрую по финансовым пирамидам.');
      setCliLogs((prev) => [...prev, 'SYSTEM: Фильтр: Пирамиды']);
    } else if (command.includes('мошенничеств') || command.includes('розыгрыш')) {
      setCategoryFilter('fraud');
      speak('Показываю мошеннические схемы и лотереи.');
      setCliLogs((prev) => [...prev, 'SYSTEM: Фильтр: Мошенничество']);
    } else if (command.includes('безопасн') || command.includes('чист')) {
      setCategoryFilter('safe');
      speak('Вывожу легитимный контент.');
      setCliLogs((prev) => [...prev, 'SYSTEM: Фильтр: Безопасно']);
    } else if (command.includes('все') || command.includes('сброс') || command.includes('очисти')) {
      setCategoryFilter('all');
      setSelectedRegion('all');
      speak('Фильтры сброшены. Карта полностью открыта.');
      setCliLogs((prev) => [...prev, 'SYSTEM: Сброс всех фильтров']);
    } else if (command.includes('астан')) {
      setSelectedRegion('astana');
      speak('Фокусируюсь на Астане.');
      announceRegion('astana');
    } else if (command.includes('алмат')) {
      setSelectedRegion('almaty');
      speak('Фокусируюсь на Алматы.');
      announceRegion('almaty');
    } else if (command.includes('шымкент')) {
      setSelectedRegion('shymkent');
      speak('Фокусируюсь на Шымкенте.');
      announceRegion('shymkent');
    } else if (command.includes('запад')) {
      setSelectedRegion('west');
      speak('Фокусируюсь на западном Казахстане.');
      announceRegion('west');
    } else if (command.includes('восток')) {
      setSelectedRegion('east');
      speak('Фокусируюсь на восточном Казахстане.');
      announceRegion('east');
    } else if (command.includes('север')) {
      setSelectedRegion('north');
      speak('Фокусируюсь на северном Казахстане.');
      announceRegion('north');
    } else if (command.includes('центр')) {
      setSelectedRegion('center');
      speak('Фокусируюсь на центральном Казахстане.');
      announceRegion('center');
    } else {
      speak('Команда не распознана. Произнесите тип угрозы или название региона.');
      setCliLogs((prev) => [...prev, 'SYSTEM: Голосовая команда не распознана. Введите "help".']);
    }
  };

  // Announce region stats with TTS
  const announceRegion = (regId: Region) => {
    const node = REGION_NODES.find((n) => n.id === regId);
    if (!node) return;
    const stats = getRegionStats(regId);
    
    let text = `Регион ${node.label}. Обнаружено ${stats.count} постов. `;
    if (stats.threatCount > 0) {
      text += `Из них ${stats.threatCount} содержат нарушения. Средний уровень кибер-угрозы составляет ${stats.avgRisk} процентов.`;
    } else {
      text += 'Подозрительной активности не выявлено. Статус безопасный.';
    }
    speak(text);
  };

  // CLI submit handler
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim().toLowerCase();
    if (!cmd) return;

    setCliLogs((prev) => [...prev, `CLI_USER > ${cliInput}`]);
    setCliInput('');

    if (cmd === 'help') {
      setCliLogs((prev) => [
        ...prev,
        '--- ДОСТУПНЫЕ КОМАНДЫ CLI ---',
        '  show casino      - Фильтр по онлайн-казино',
        '  show pyramid     - Фильтр по финансовым пирамидам',
        '  show fraud       - Фильтр по мошенничеству',
        '  show safe        - Фильтр по безопасному контенту',
        '  show all         - Показать всё (сброс фильтров)',
        '  select <region>  - Выбрать регион (almaty, astana, shymkent, west, east, north, center)',
        '  select all       - Сбросить регион',
        '  status           - Показать общую статистику системы',
        '  clear            - Очистить экран консоли',
        '-----------------------------'
      ]);
    } else if (cmd === 'clear') {
      setCliLogs([]);
    } else if (cmd === 'status') {
      const activeThreats = posts.filter(p => p.category !== 'safe').length;
      const ratio = posts.length ? Math.round((activeThreats / posts.length) * 100) : 0;
      setCliLogs((prev) => [
        ...prev,
        `--- СТАТУС МОНИТОРИНГА РК ---`,
        `  Всего постов в базе: ${posts.length}`,
        `  Активных угроз: ${activeThreats}`,
        `  Доля инцидентов: ${ratio}%`,
        `  API Whisper / Claude: Активны`,
        `-----------------------------`
      ]);
      speak(`Система содержит ${posts.length} постов, обнаружено ${activeThreats} инцидентов.`);
    } else if (cmd.startsWith('show ')) {
      const type = cmd.replace('show ', '');
      if (['casino', 'pyramid', 'fraud', 'safe', 'all'].includes(type)) {
        setCategoryFilter(type as Category | 'all');
        const labels: Record<string, string> = { casino: 'Казино', pyramid: 'Пирамиды', fraud: 'Мошенничество', safe: 'Безопасно', all: 'Все' };
        setCliLogs((prev) => [...prev, `SYSTEM: Фильтр категорий изменен на: ${labels[type]}`]);
        speak(`Фильтр изменен на ${labels[type]}`);
      } else {
        setCliLogs((prev) => [...prev, `CLI_ERROR: Неизвестная категория "${type}"`]);
      }
    } else if (cmd.startsWith('select ')) {
      const reg = cmd.replace('select ', '');
      if (reg === 'all') {
        setSelectedRegion('all');
        setCliLogs((prev) => [...prev, 'SYSTEM: Фокус региона сброшен']);
        speak('Фокус на всю карту.');
      } else if (['almaty', 'astana', 'shymkent', 'west', 'east', 'north', 'center'].includes(reg)) {
        setSelectedRegion(reg as Region);
        setCliLogs((prev) => [...prev, `SYSTEM: Выбран регион: ${reg}`]);
        announceRegion(reg as Region);
      } else {
        setCliLogs((prev) => [...prev, `CLI_ERROR: Неизвестный регион "${reg}"`]);
      }
    } else {
      setCliLogs((prev) => [...prev, `CLI_ERROR: Команда "${cmd}" не распознана. Введите "help".`]);
    }
  };

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-7xl relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Controls, Assistant, Voice Orb */}
        <div className="space-y-6">
          
          {/* Header info */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-3xl animate-pulse" style={symFill}>settings_input_antenna</span>
              <h1 className="num-display text-2xl md:text-3xl text-on-surface">Командный центр</h1>
            </div>
            <p className="text-xs text-on-surface-variant font-code-sm uppercase tracking-widest text-primary">
              FRAUD RADAR · KAZAKHSTAN OSINT
            </p>
          </div>

          {/* Glowing Voice Orb */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[220px]">
            {/* Animated bg glows */}
            <div className="absolute inset-0 bg-radial-gradient(ellipse at 50% 50%, rgba(206,255,26,0.06), transparent 75%) pointer-events-none" />
            
            {/* holographic voice orb representation */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-4">
              {/* Outer pulsing rings */}
              <motion.div
                animate={{ scale: isListening ? [1, 1.25, 1] : [1, 1.05, 1], opacity: isListening ? [0.4, 0.8, 0.4] : 0.2 }}
                transition={{ repeat: Infinity, duration: isListening ? 1.2 : 2.5, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full border border-primary/40 bg-primary/5"
              />
              <motion.div
                animate={{ scale: isListening ? [1.1, 1.4, 1.1] : [1.02, 1.1, 1.02], opacity: isListening ? [0.2, 0.6, 0.2] : 0.1 }}
                transition={{ repeat: Infinity, duration: isListening ? 1.5 : 3, ease: 'easeInOut', delay: 0.2 }}
                className="absolute inset-0 rounded-full border border-primary/20 bg-primary/2"
              />

              {/* Main Glowing Orb */}
              <motion.div
                animate={isListening ? {
                  borderRadius: ["42% 58% 70% 30% / 45% 45% 55% 55%", "70% 30% 52% 48% / 60% 40% 60% 40%", "42% 58% 70% 30% / 45% 45% 55% 55%"],
                  rotate: 360
                } : {
                  borderRadius: ["50%", "48% 52% 50% 50% / 52% 48% 52% 48%", "50%"],
                  rotate: 0
                }}
                transition={{
                  repeat: Infinity,
                  duration: isListening ? 4 : 8,
                  ease: "linear"
                }}
                className="w-16 h-16 bg-gradient-to-tr from-primary via-secondary-container to-[#8b6dff] shadow-[0_0_30px_rgba(206,255,26,0.5)] flex items-center justify-center text-on-primary"
              >
                <span className="material-symbols-outlined text-2xl" style={symFill}>
                  {isListening ? 'graphic_eq' : 'shield_person'}
                </span>
              </motion.div>
            </div>

            {/* Voice feedback & Button */}
            <div className="z-10 space-y-3">
              <h3 className="font-semibold text-on-surface text-sm">AI Ассистент «Каспи-Щит»</h3>
              <p className="text-xs text-on-surface-variant font-code-sm px-4 leading-relaxed max-w-[260px] min-h-[32px]">
                {isListening ? spokenText : 'Нажмите кнопку и говорите: "покажи казино", "выбери алматы", "сбрось все"'}
              </p>
              
              <button
                onClick={toggleListening}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all duration-300 shadow-md ${
                  isListening 
                    ? 'bg-error text-white shadow-error/30 scale-105 border border-error/50' 
                    : 'bg-primary text-on-primary shadow-primary/30 hover:scale-105 border border-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{isListening ? 'stop' : 'mic'}</span>
                <span>{isListening ? 'Идет запись...' : 'Активировать голос'}</span>
              </button>
            </div>
          </div>

          {/* Cyber Terminal CLI Console */}
          <div className="glass-card p-4 flex flex-col min-h-[220px] max-h-[260px]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 mb-2 justify-between">
              <span className="font-code-sm text-[10px] uppercase text-on-surface-variant tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                CYBER SHELL TERMINAL v1.0.8
              </span>
              <button 
                onClick={() => setCliLogs([])}
                className="text-[10px] text-on-surface-variant/40 hover:text-on-surface font-mono"
              >
                [clear]
              </button>
            </div>

            {/* Terminal output */}
            <div 
              ref={cliScrollRef} 
              className="flex-1 overflow-y-auto font-mono text-[11px] text-primary/80 space-y-1 pr-1"
              style={{ textShadow: '0 0 2px rgba(206,255,26,0.15)' }}
            >
              {cliLogs.map((log, idx) => (
                <div key={idx} className={log.startsWith('CLI_USER') ? 'text-secondary-container' : log.startsWith('CLI_ERROR') ? 'text-error' : 'text-primary'}>
                  {log}
                </div>
              ))}
            </div>

            {/* Terminal Input Form */}
            <form onSubmit={handleCliSubmit} className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
              <span className="font-mono text-xs text-primary/60">$ console &gt;</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Введите команду (например: help)"
                className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-on-surface placeholder:text-on-surface-variant/30"
              />
            </form>
          </div>

        </div>

        {/* Center column: Interactive SVG Map (2 cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          
          {/* Map Display Card */}
          <div className="glass-card p-4 flex-1 flex flex-col min-h-[380px] relative overflow-hidden">
            {/* Visual Header / Filter controls */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4 z-10 border-b border-white/[0.06] pb-3">
              <div>
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">КАРТА УГРОЗ КАЗАХСТАНА</h3>
                <p className="text-[10px] font-code-sm text-on-surface-variant/60 uppercase">
                  Кликните по узлу города для вывода аудиоотчета
                </p>
              </div>

              {/* Filtering indicators */}
              <div className="flex gap-2">
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    const reg = e.target.value as Region | 'all';
                    setSelectedRegion(reg);
                    if (reg !== 'all') announceRegion(reg);
                  }}
                  className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-3 py-1 text-xs text-on-surface focus:outline-none"
                >
                  <option value="all">Все регионы</option>
                  {REGION_NODES.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')}
                  className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-3 py-1 text-xs text-on-surface focus:outline-none"
                >
                  <option value="all">Все угрозы</option>
                  <option value="casino">Казино</option>
                  <option value="pyramid">Пирамиды</option>
                  <option value="fraud">Мошенничество</option>
                  <option value="safe">Безопасно</option>
                </select>
              </div>
            </div>

            {/* SVG Interactive Map */}
            <div className="flex-1 flex items-center justify-center relative select-none w-full p-4">
              <KazakhstanMap
                selectedRegion={selectedRegion}
                onSelectRegion={(reg) => {
                  setSelectedRegion(reg);
                  if (reg !== 'all') {
                    announceRegion(reg);
                    const node = REGION_NODES.find((n) => n.id === reg);
                    setCliLogs((prev) => [...prev, `SYSTEM: Выбран регион: ${node?.label || reg}`]);
                  }
                }}
              />

              {/* Telemetry log Overlay (bottom corner of map) */}
              <div className="absolute bottom-3 left-3 bg-surface-container-low/95 border border-white/5 p-3 rounded-xl max-w-[280px] font-mono text-[10px] text-on-surface-variant pointer-events-none hidden md:block">
                <div className="text-primary font-bold mb-1">СВОДКА КИБЕРКАРТЫ:</div>
                <div>Выбран регион: <span className="text-on-surface font-semibold">{selectedRegion === 'all' ? 'Вся Республика' : REGION_NODES.find(n => n.id === selectedRegion)?.label}</span></div>
                <div>Отфильтровано угроз: <span className="text-on-surface font-semibold">{filteredPosts.length} постов</span></div>
                <div>Активностей в базе: <span className="text-on-surface font-semibold">{posts.length} инцидентов</span></div>
              </div>
            </div>

            {/* Regional detail card (visible when a region is selected) */}
            <AnimatePresence>
              {selectedRegion !== 'all' && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="mt-4 p-4 bg-surface-container-lowest/80 border border-white/10 rounded-2xl flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex-1 min-w-[240px]">
                    <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                      {REGION_NODES.find((n) => n.id === selectedRegion)?.label}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {REGION_NODES.find((n) => n.id === selectedRegion)?.info}
                    </p>
                  </div>

                  {/* Quick stats grid */}
                  <div className="flex gap-4 shrink-0">
                    <div className="text-center bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5">
                      <div className="text-sm font-bold text-on-surface">{getRegionStats(selectedRegion).count}</div>
                      <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 font-code-sm">Постов</div>
                    </div>
                    <div className="text-center bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5">
                      <div className="text-sm font-bold text-error">{getRegionStats(selectedRegion).threatCount}</div>
                      <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 font-code-sm">Угрозы</div>
                    </div>
                    <div className="text-center bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5">
                      <div className="text-sm font-bold text-primary">{getRegionStats(selectedRegion).avgRisk}%</div>
                      <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 font-code-sm">Риск</div>
                    </div>
                    
                    {/* Clear selection button */}
                    <button 
                      onClick={() => setSelectedRegion('all')}
                      className="p-2 hover:bg-white/5 rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
                      title="Сбросить фокус"
                    >
                      <span className="material-symbols-outlined text-sm" style={sym}>close</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Alert Feed / Telemetry list */}
          <div className="glass-card p-4">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-3">ЛЕНТА ИНЦИДЕНТОВ В РЕГИОНЕ</h3>
            
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {filteredPosts.map((post) => {
                const regionName = REGION_NODES.find(n => n.id === post.region)?.label ?? 'Республика';

                return (
                  <motion.div
                    key={post.id}
                    className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer"
                    whileHover={{ x: 3 }}
                    onClick={() => {
                      speak(`Информационная сводка. Пост от ${post.username}. Категория ${getCategoryLabel(post.category)}. Уровень угрозы ${post.riskScore} процентов.`);
                      setCliLogs((prev) => [...prev, `TELEMETRY: Выбран пост @${post.username} (${regionName})`]);
                    }}
                  >
                    {/* Preview thumbnail placeholder */}
                    <div 
                      className="w-10 h-10 rounded-lg border border-white/10 shrink-0" 
                      style={{ backgroundColor: post.thumbnailColor ?? '#1c1f29' }}
                    />

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-on-surface truncate">@{post.username}</span>
                        <span className="text-[9px] uppercase font-mono text-on-surface-variant/50">· {post.platform}</span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-primary shrink-0 border border-white/5">
                          {regionName}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5 max-w-[400px]">
                        {post.caption}
                      </p>
                    </div>

                    {/* Threat indicator */}
                    <div className="shrink-0 flex items-center gap-3">
                      <span className="text-xs text-on-surface-variant/50 font-mono hidden md:inline">
                        {new Date(post.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <RiskBadge score={post.riskScore} size="sm" />
                    </div>
                  </motion.div>
                );
              })}

              {filteredPosts.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant font-code-sm text-xs">
                  <span className="material-symbols-outlined text-2xl opacity-40 block mb-2" style={sym}>search_off</span>
                  Нет инцидентов, удовлетворяющих заданным фильтрам.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </SidebarLayout>
  );
}
