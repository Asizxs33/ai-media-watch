import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/commandcenter', icon: 'settings_input_antenna', label: 'Командный центр' },
  { path: '/livescanner', icon: 'sensors', label: 'Live Сканер' },
  { path: '/scanner', icon: 'smart_toy', label: 'Анализ' },
  { path: '/dashboard', icon: 'dashboard', label: 'Дашборд' },
  { path: '/registry', icon: 'fingerprint', label: 'Реестр' },
  { path: '/trends', icon: 'ssid_chart', label: 'Тренды' },
  { path: '/stats', icon: 'monitoring', label: 'Статистика' },
];

const sym = { fontVariationSettings: "'FILL' 0" };

export function Sidebar() {
  return (
    <aside className="group w-20 hover:w-64 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hidden md:flex flex-col bg-surface-container z-40 shrink-0 overflow-hidden relative floating-sidebar">
      {/* Logo */}
      <div className="px-5 py-7 flex items-center gap-3 min-w-0 relative z-10">
        <div className="w-12 h-12 shrink-0 flex items-center justify-center">
          <img src="/logo.png" alt="Spectra AI" width={52} height={52} />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
          <p className="num-display text-on-surface text-sm">SPECTRA AI</p>
          <p className="text-on-surface-variant text-[10px] font-code-sm tracking-wider">FRAUD INTELLIGENCE</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1.5 w-full px-3 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined shrink-0 text-xl" style={sym}>{item.icon}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap text-sm tracking-tight">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="px-5 py-6 border-t border-white/[0.06] mt-auto relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap text-on-surface-variant text-[11px] font-code-sm tracking-widest uppercase">
            Система активна
          </span>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 flex md:hidden bg-surface-container/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 gap-0.5 transition-all rounded-xl ${
              isActive
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-lg" style={sym}>{item.icon}</span>
          <span className="text-[9px] font-code-sm tracking-wider scale-90">{item.label.split(' ')[0]}</span>
        </NavLink>
      ))}
    </nav>
  );
}
