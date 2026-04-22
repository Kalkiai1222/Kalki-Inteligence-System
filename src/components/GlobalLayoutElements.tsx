'use client';

import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, Settings, LogOut, Menu, X, Users, Briefcase } from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Companies', href: '/dashboard/companies', icon: Building2 },
  { name: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
  { name: 'Users', href: '/dashboard/users', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function GlobalSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!user) return null;

  return (
    <>
      {/* Mobile Topbar & Hamburger */}
      <div className="lg:hidden flex items-center justify-between bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 text-white px-4 py-4 sticky top-0 z-40 shadow-sm">
        <Link href="/dashboard" className="text-lg font-black tracking-[0.2em] flex items-center gap-3 uppercase italic">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <span className="text-white font-black text-xs">K</span>
          </div>
          Kalki
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-11 w-11 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-slate-400"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Navigation Drawer/Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[clamp(16rem,85vw,18rem)] max-w-[85vw] bg-slate-950 border-r border-slate-800 text-slate-400
        transform transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) lg:translate-x-0 lg:static lg:block
        flex flex-col
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-900">
          <Link href="/dashboard" className="text-xs font-black tracking-[0.3em] flex items-center gap-3 uppercase group italic">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-900/40 group-hover:scale-110 transition-transform">
              <span className="text-white font-black leading-none text-sm">K</span>
            </div>
            <span className="text-white">Kalki Intel</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 space-y-2">
          {navigation.map((item, i) => {
             const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
             return (
               <Link
                 key={item.name}
                 href={item.href}
                 className={`
                   flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-400
                   font-bold text-xs uppercase tracking-[0.2em] italic min-h-11
                   delay-${(i * 50).toString()} animate-slide-up-fade opacity-0
                   ${isActive 
                     ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-900/50 border border-indigo-400/30' 
                     : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200 border border-transparent'}
                 `}
                 style={{ animationFillMode: 'forwards' }}
               >
                 <item.icon size={16} strokeWidth={isActive ? 3 : 2} className={isActive ? 'text-white' : 'opacity-40'} />
                 {item.name}
               </Link>
             );
          })}
        </nav>

        <div className="p-4 sm:p-6 border-t border-slate-900 flex items-center justify-between mt-auto bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-4 max-w-[calc(100%-3rem)]">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 flex-shrink-0 text-indigo-400 shadow-lg">
              <span className="font-black text-xs uppercase">{user.name?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-black text-white tracking-widest uppercase truncate italic">{user.name || 'Engineer'}</span>
              <span className="text-xs text-slate-500 font-mono truncate tracking-tight">{user.email}</span>
            </div>
          </div>
          <button onClick={logout} className="h-11 w-11 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" title="Secure Termination">
            <LogOut size={18} strokeWidth={3} />
          </button>
        </div>
      </aside>


      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-md transition-opacity duration-500"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

export function GlobalTopbar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <header className="h-16 bg-slate-950/60 backdrop-blur-2xl sticky top-0 z-30 hidden lg:flex items-center border-b border-slate-900 shadow-2xl transition-all">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-end gap-6">
        <ThemeToggle />
        <NotificationsDropdown />
        <div className="h-8 w-px bg-slate-800/50 mx-1"></div>
        <div className="flex items-center gap-3 bg-slate-900/40 px-4 py-2 rounded-full border border-slate-800/50 shadow-inner">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-900/50"></div>
           <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] italic">Network Secure</span>
        </div>
      </div>
    </header>
  );
}


export function GlobalFooter() {
  return (
    <footer className="mt-auto py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-900 text-center lg:text-left text-xs text-slate-500 font-bold uppercase tracking-widest italic opacity-60">
      &copy; {new Date().getFullYear()} Kalki Intelligence. Engineered for spatial truth.
    </footer>
  );
}
