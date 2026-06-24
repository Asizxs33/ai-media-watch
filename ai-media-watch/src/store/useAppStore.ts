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


export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      posts: [],
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

          set({ posts: converted });
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
      name: 'spectra-ai-results',
      // posts come from DB, filters saved locally
      partialize: (s) => ({ filters: s.filters }),
    }
  )
);
