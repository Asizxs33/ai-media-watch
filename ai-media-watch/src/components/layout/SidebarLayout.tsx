import type { ReactNode } from 'react';
import { Sidebar, MobileNav } from './Sidebar';

interface Props {
  children: ReactNode;
}

export function SidebarLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-background relative overflow-x-hidden">
      {/* Living background */}
      <div className="atmos">
        <div className="atmos-grid" />
        <div className="aura aura--lime" />
        <div className="aura aura--violet" />
      </div>

      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 h-16 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="num-display text-lg text-on-surface">AI Media Watch</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-code-sm text-[11px] text-on-surface-variant uppercase tracking-widest hidden sm:block">
              Казахстан · LIVE
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-24 md:pb-6">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
