import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { useAppStore } from '../store/useAppStore';
import { RiskBadge, getRiskColor, getCategoryLabel } from '../components/ui/RiskBadge';
import type { Platform, Category, PostStatus } from '../types';

const PAGE_SIZE = 10;

const sym = { fontVariationSettings: "'FILL' 0" };

export default function Dashboard() {
  const navigate = useNavigate();
  const { filters, setFilters, filteredPosts } = useAppStore();
  const posts = filteredPosts();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(posts.length / PAGE_SIZE);
  const paginated = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const platformLabels: Record<string, string> = {
    tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube'
  };

  return (
    <SidebarLayout>
      <div className="p-4 md:p-6 max-w-7xl">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="num-display text-4xl md:text-5xl text-on-surface mb-2">Дашборд</h1>
          <p className="font-code-sm text-code-sm text-on-surface-variant">
            Всего постов:{' '}
            <span className="text-primary font-semibold">{posts.length}</span>
          </p>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mb-6 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Поиск по аккаунту, тексту, хэштегу..."
            value={filters.search}
            onChange={(e) => { setFilters({ search: e.target.value }); setPage(1); }}
            className="flex-1 min-w-48 bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary-container/40 font-body-md"
          />

          <select
            value={filters.platform}
            onChange={(e) => { setFilters({ platform: e.target.value as Platform | 'all' }); setPage(1); }}
            className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary-container/40"
          >
            <option value="all">Все платформы</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => { setFilters({ category: e.target.value as Category | 'all' }); setPage(1); }}
            className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary-container/40"
          >
            <option value="all">Все категории</option>
            <option value="safe">Безопасно</option>
            <option value="casino">Казино</option>
            <option value="pyramid">Пирамида</option>
            <option value="fraud">Мошенничество</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => { setFilters({ status: e.target.value as PostStatus | 'all' }); setPage(1); }}
            className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary-container/40"
          >
            <option value="all">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="reviewed">Проверено</option>
            <option value="blocked">Заблокировано</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as 'riskScore' | 'timestamp' | 'views' })}
            className="bg-surface-container-lowest/60 border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary-container/40 font-mono"
          >
            <option value="riskScore">По риску ↓</option>
            <option value="timestamp">По дате ↓</option>
            <option value="views">По просмотрам ↓</option>
          </select>

          <button
            onClick={() => useAppStore.getState().resetFilters()}
            className="btn-cyber-skew px-4 py-2 text-sm"
          >
            <span>Сбросить</span>
          </button>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden p-0">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[72px_1fr_120px_150px_130px_100px_64px] gap-4 px-4 py-3 border-b border-white/[0.06] bg-surface-container-lowest/40">
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">Превью</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">Аккаунт</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">Платформа</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">Категория</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">Риск</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">Дата</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-right">Детали</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {paginated.map((post, i) => {
              const colors = getRiskColor(post.riskScore);
              const isHighRisk = post.riskScore > 70;
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`group flex flex-wrap md:grid md:grid-cols-[72px_1fr_120px_150px_130px_100px_64px] gap-4 items-center px-4 py-3 hover:bg-white/[0.03] transition-all duration-300 cursor-pointer relative overflow-hidden
                    ${isHighRisk ? 'border-l-2 border-l-error bg-error-container/5' : ''}
                  `}
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-out pointer-events-none" />
                  <div
                    className="w-12 h-12 rounded-lg shrink-0 border border-white/10"
                    style={{ background: post.thumbnailColor }}
                  />

                  <div className="flex items-center gap-3 min-w-0">
                    <img src={post.avatar} className="w-8 h-8 rounded-full shrink-0" alt="" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">@{post.username}</p>
                      <p className="text-xs text-on-surface-variant truncate max-w-48">
                        {post.caption.slice(0, 50)}...
                      </p>
                    </div>
                  </div>

                  <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                    {platformLabels[post.platform] ?? post.platform}
                  </span>

                  <span className={`text-xs font-medium ${colors.text}`}>
                    {getCategoryLabel(post.category)}
                  </span>

                  <div className="space-y-1.5 w-full">
                    <RiskBadge score={post.riskScore} size="sm" />
                    <div className="w-full bg-white/[0.06] rounded-full h-1 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${post.riskScore}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: i * 0.05 }}
                        className="h-1 rounded-full relative"
                        style={{ backgroundColor: colors.bar }}
                      >
                        {isHighRisk && (
                          <div className="absolute inset-0 bg-white/30 animate-[shimmerSlide_2s_infinite]" />
                        )}
                      </motion.div>
                    </div>
                  </div>

                  <span className="text-xs text-on-surface-variant font-code-sm">
                    {new Date(post.timestamp).toLocaleDateString('ru-RU')}
                  </span>

                  <div className="text-right">
                    <button className="text-on-surface-variant/40 group-hover:text-secondary-container transition-colors">
                      <span className="material-symbols-outlined text-lg" style={sym}>open_in_new</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {paginated.length === 0 && (
            <div className="py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3 block opacity-40" style={sym}>search</span>
              <p className="font-code-sm text-code-sm">Ничего не найдено. Измените фильтры.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-white/10 rounded text-on-surface-variant disabled:opacity-40 hover:border-secondary-container/30 hover:text-secondary-container transition-colors"
            >
              ← Назад
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  page === p
                    ? 'bg-secondary-container/15 border border-secondary-container/30 text-secondary-container'
                    : 'border border-white/10 text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-white/10 rounded text-on-surface-variant disabled:opacity-40 hover:border-secondary-container/30 hover:text-secondary-container transition-colors"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
