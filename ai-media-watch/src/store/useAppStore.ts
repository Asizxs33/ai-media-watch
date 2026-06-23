import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Post, Category, Platform, PostStatus, RequisiteType } from '../types';
import { BACKEND } from '../config';

export interface RegistryEntry {
  type: RequisiteType;
  value: string;
  count: number;              // в скольких постах встречается
  accounts: string[];         // уникальные аккаунты
  platforms: Platform[];      // уникальные платформы
  categories: Category[];     // уникальные категории
  maxRisk: number;
  postIds: string[];
}

export type AnalystTone = 'safe' | 'warn' | 'threat' | 'info';

export interface AnalystMsg {
  id: string;
  text: string;
  tone: AnalystTone;
  postId?: string;
  timestamp: string;
}

interface Filters {
  platform: Platform | 'all';
  category: Category | 'all';
  status: PostStatus | 'all';
  search: string;
  sortBy: 'riskScore' | 'timestamp' | 'views';
}

interface AppState {
  posts: Post[];
  filters: Filters;
  analyst: AnalystMsg[];

  addPost: (post: Post) => void;
  removePost: (id: string) => void;
  setFilters: (f: Partial<Filters>) => void;
  resetFilters: () => void;
  updatePostStatus: (id: string, status: PostStatus) => void;
  filteredPosts: () => Post[];
  requisitesRegistry: () => RegistryEntry[];
  pushAnalyst: (text: string, tone: AnalystTone, postId?: string) => void;
  clearAnalyst: () => void;
  loadPostsFromDb: () => Promise<void>;
}

const defaultFilters: Filters = {
  platform: 'all',
  category: 'all',
  status: 'all',
  search: '',
  sortBy: 'riskScore',
};

const SEED_POSTS: Post[] = [
  {
    id: 'seed-1',
    platform: 'tiktok',
    username: 'olx_job_astana',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=olx_job_astana',
    caption: 'Быстрая работа для студентов в Астане! Зарплата от 25 000 тг в день. Пишите в WhatsApp +77079123456. Свободный график, места ограничены!',
    hashtags: ['работа', 'астана', 'студенты', 'легкиеденьги'],
    thumbnailColor: '#1c1f29',
    videoTranscript: '',
    ocrText: '',
    riskScore: 82,
    category: 'fraud',
    detectedMarkers: ['быстрый заработок', 'предоплата', 'нет договора'],
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'pending',
    views: 12500,
    likes: 420,
    requisites: [
      { type: 'whatsapp', value: '+7 707 912 3456' },
      { type: 'phone', value: '+77079123456' }
    ],
    region: 'astana'
  },
  {
    id: 'seed-2',
    platform: 'instagram',
    username: 'darim_kaspi_gifts',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=darim_kaspi_gifts',
    caption: '🔥 Розыгрыш 100 000 тг от Kaspi! Каждому второму участнику переведем бонус. Для регистрации отправьте комиссию 2000 тг на Kaspi по номеру 87079123456 и пришлите чек в Telegram @kaspi_admin_help',
    hashtags: ['розыгрыш', 'халява', 'алматы', 'каспи'],
    thumbnailColor: '#ff5640',
    videoTranscript: '',
    ocrText: '',
    riskScore: 95,
    category: 'fraud',
    detectedMarkers: ['комиссия за выигрыш', 'фейковый розыгрыш', 'сбор средств'],
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'pending',
    views: 45000,
    likes: 2300,
    requisites: [
      { type: 'kaspi', value: '87079123456' },
      { type: 'whatsapp', value: '+7 707 912 3456' },
      { type: 'telegram', value: '@kaspi_admin_help' }
    ],
    region: 'almaty'
  },
  {
    id: 'seed-3',
    platform: 'youtube',
    username: 'casino_vulcan_kz',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=casino_vulcan_kz',
    caption: 'Как обыграть слоты в онлайн-казино? Секретная схема 2026. Переходи по ссылке в описании vulcan-slots-kz.net и вводи промокод KAZWIN777 для получения +200% к первому депозиту!',
    hashtags: ['казино', 'слоты', 'схемавыигрыша', 'казиновулкан'],
    thumbnailColor: '#8b6dff',
    videoTranscript: 'Всем привет, сегодня я покажу как поднять бабло на слотах. Ссылка на сайт под видео, используйте мой промокод KAZWIN777.',
    ocrText: '',
    riskScore: 98,
    category: 'casino',
    detectedMarkers: ['ссылка на зеркало', 'промокод', 'гарантия выигрыша'],
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    status: 'pending',
    views: 89000,
    likes: 5400,
    requisites: [
      { type: 'link', value: 'vulcan-slots-kz.net' },
      { type: 'promo', value: 'KAZWIN777' },
      { type: 'telegram', value: '@kaspi_admin_help' }
    ],
    region: 'shymkent'
  },
  {
    id: 'seed-4',
    platform: 'tiktok',
    username: 'crypto_nur_invest',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=crypto_nur_invest',
    caption: 'Инвестиции нового поколения в Казахстане! Пассивный доход 40% в неделю. Никаких рисков, выплаты на Kaspi Gold или USDT. Пишите нашему менеджеру @kaspi_admin_help',
    hashtags: ['инвестиции', 'крипта', 'пассивныйдоход', 'казахстан'],
    thumbnailColor: '#ceff1a',
    videoTranscript: '',
    ocrText: '',
    riskScore: 89,
    category: 'pyramid',
    detectedMarkers: ['высокая доходность', 'гарантия дохода', 'рефералы'],
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    status: 'pending',
    views: 18000,
    likes: 910,
    requisites: [
      { type: 'telegram', value: '@kaspi_admin_help' },
      { type: 'crypto', value: '0x71C...3A9f' }
    ],
    region: 'west'
  },
  {
    id: 'seed-5',
    platform: 'instagram',
    username: 'qz_forex_signals',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=qz_forex_signals',
    caption: 'Лучшие сигналы для трейдинга. Точность 98%! Доступ в закрытый VIP-чат бесплатный при регистрации по ссылке. Связаться в Telegram: @kaspi_admin_help или WhatsApp +77079123456',
    hashtags: ['трейдинг', 'сигналы', 'форекс', 'казахстан'],
    thumbnailColor: '#9498a1',
    videoTranscript: '',
    ocrText: '',
    riskScore: 75,
    category: 'pyramid',
    detectedMarkers: ['нереальная точность', 'сигналы', 'без лицензии'],
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'pending',
    views: 8400,
    likes: 350,
    requisites: [
      { type: 'telegram', value: '@kaspi_admin_help' },
      { type: 'whatsapp', value: '+7 707 912 3456' }
    ],
    region: 'center'
  },
  {
    id: 'seed-6',
    platform: 'youtube',
    username: 'vlog_almaty_travel',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=vlog_almaty_travel',
    caption: 'Прогулка по Медео и Чимбулаку. Красота гор Алматы летом 2026! Советы туристам.',
    hashtags: ['алматы', 'медео', 'туризм', 'казахстан'],
    thumbnailColor: '#46e08a',
    videoTranscript: 'Всем привет, сегодня мы гуляем по горам Алматы, здесь очень красивый воздух...',
    ocrText: '',
    riskScore: 5,
    category: 'safe',
    detectedMarkers: [],
    timestamp: new Date(Date.now() - 3600000 * 36).toISOString(),
    status: 'reviewed',
    views: 3200,
    likes: 180,
    requisites: [],
    region: 'almaty'
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      posts: SEED_POSTS,
      filters: defaultFilters,
      analyst: [],

      addPost: (post) =>
        set((s) =>
          s.posts.some((p) => p.id === post.id)
            ? s // тот же ролик уже сохранён (нашёлся по нескольким ключевым словам)
            : { posts: [post, ...s.posts] }
        ),

      removePost: (id) =>
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
      resetFilters: () => set({ filters: defaultFilters }),

      updatePostStatus: (id, status) => {
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, status } : p)),
        }));
        // Sync to DB (fire and forget)
        fetch(`${BACKEND}/api/posts/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }).catch(() => {});
      },

      pushAnalyst: (text, tone, postId) =>
        set((s) => ({
          analyst: [
            ...s.analyst,
            { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, tone, postId, timestamp: new Date().toISOString() },
          ].slice(-40),
        })),

      clearAnalyst: () => set({ analyst: [] }),

      loadPostsFromDb: async () => {
        try {
          const res = await fetch(`${BACKEND}/api/posts?limit=200`);
          if (!res.ok) return;
          const { posts: dbPosts } = await res.json();
          if (!Array.isArray(dbPosts) || dbPosts.length === 0) return;

          const converted: Post[] = dbPosts.map((r: any) => ({
            id: r.id,
            platform: r.platform ?? 'youtube',
            username: r.username ?? '',
            avatar: r.avatar ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.username ?? r.id)}`,
            caption: r.caption ?? '',
            hashtags: [],
            thumbnailColor: r.thumbnailColor ?? '#1c1f29',
            videoTranscript: '',
            ocrText: '',
            riskScore: typeof r.riskScore === 'number' ? r.riskScore : parseFloat(r.riskScore ?? '0'),
            category: r.category ?? 'safe',
            detectedMarkers: Array.isArray(r.schemeTypes) ? r.schemeTypes : [],
            timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
            status: r.status ?? 'pending',
            views: r.viewCount ?? r.views ?? 0,
            likes: r.likeCount ?? r.likes ?? 0,
            url: r.url ?? '',
            requisites: Array.isArray(r.requisites) ? r.requisites : [],
          }));

          // Replace all posts with DB data so all users see the same data
          // Keep seed posts only if they don't overlap with DB
          const dbIds = new Set(converted.map((p) => p.id));
          const seedOnly = SEED_POSTS.filter((p) => !dbIds.has(p.id));
          set({ posts: [...converted, ...seedOnly] });
        } catch {
          // silently fail — backend may be offline
        }
      },

      filteredPosts: () => {
        const { posts, filters } = get();
        let result = [...posts];

        if (filters.platform !== 'all')
          result = result.filter((p) => p.platform === filters.platform);
        if (filters.category !== 'all')
          result = result.filter((p) => p.category === filters.category);
        if (filters.status !== 'all')
          result = result.filter((p) => p.status === filters.status);
        if (filters.search)
          result = result.filter(
            (p) =>
              p.username.toLowerCase().includes(filters.search.toLowerCase()) ||
              p.caption.toLowerCase().includes(filters.search.toLowerCase()) ||
              p.hashtags.some((h) => h.toLowerCase().includes(filters.search.toLowerCase()))
          );

        result.sort((a, b) => {
          if (filters.sortBy === 'riskScore') return b.riskScore - a.riskScore;
          if (filters.sortBy === 'timestamp')
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          if (filters.sortBy === 'views') return (b.views ?? 0) - (a.views ?? 0);
          return 0;
        });

        return result;
      },

      requisitesRegistry: () => {
        const { posts } = get();
        const map = new Map<string, RegistryEntry>();

        for (const post of posts) {
          for (const req of post.requisites ?? []) {
            const value = req.value.trim();
            if (!value) continue;
            // ключ — нормализованное значение (без учёта регистра/пробелов)
            const key = `${req.type}:${value.toLowerCase().replace(/\s+/g, '')}`;
            const existing = map.get(key);
            if (existing) {
              existing.count++;
              if (!existing.accounts.includes(post.username)) existing.accounts.push(post.username);
              if (!existing.platforms.includes(post.platform)) existing.platforms.push(post.platform);
              if (!existing.categories.includes(post.category)) existing.categories.push(post.category);
              existing.maxRisk = Math.max(existing.maxRisk, post.riskScore);
              existing.postIds.push(post.id);
            } else {
              map.set(key, {
                type: req.type,
                value,
                count: 1,
                accounts: [post.username],
                platforms: [post.platform],
                categories: [post.category],
                maxRisk: post.riskScore,
                postIds: [post.id],
              });
            }
          }
        }

        // Сортировка: сначала те, что засветились в нескольких схемах, затем по риску
        return [...map.values()].sort(
          (a, b) => b.count - a.count || b.maxRisk - a.maxRisk
        );
      },
    }),
    {
      name: 'ai-media-watch-results',
      // posts come from DB, filters saved locally
      partialize: (s) => ({ filters: s.filters }),
    }
  )
);
