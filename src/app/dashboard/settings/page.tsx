'use client';

import { useAuth } from '@/hooks/useAuth';
import { Settings, ShieldCheck, CreditCard, Bell, Key } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  const settingMenus = [
    { id: 'profile', icon: Settings, label: 'General', desc: 'Account defaults and details' },
    { id: 'security', icon: ShieldCheck, label: 'Security & Privacy', desc: 'Two-factor and password' },
    { id: 'billing', icon: CreditCard, label: 'Billing & Plans', desc: 'Subscription details' },
    { id: 'notifications', icon: Bell, label: 'Notifications', desc: 'Email alerts and push' },
    { id: 'api', icon: Key, label: 'API Keys', desc: 'Manage access tokens' },
  ];

  return (
    <div className="w-full flex-1 flex flex-col pt-4 md:pt-6 lg:pt-8 animate-slide-up-fade overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-2 leading-snug">Settings</h1>
          <p className="text-[var(--text-muted)] text-sm md:text-base leading-relaxed max-w-prose">
            Manage your account configurations and system preferences.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-1">
          {settingMenus.map((menu, i) => (
             <button 
               key={menu.id} 
               className={`w-full text-left flex items-center gap-3 px-4 py-3 min-h-11 rounded-[12px] transition-colors
                 ${i === 0 
                   ? 'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm' 
                   : 'text-[var(--text-muted)] hover:bg-[var(--color-surface)]/50 border border-transparent'}
               `}
             >
               <menu.icon size={18} className={i === 0 ? 'text-[var(--color-accent)]' : 'opacity-70'} />
               <span className="font-medium text-sm md:text-base">{menu.label}</span>
             </button>
          ))}
        </div>
        
        <div className="lg:col-span-3">
          <div className="card-premium p-4 md:p-6 lg:p-8 min-h-[clamp(24rem,50vh,38rem)] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 mb-4 flex items-center justify-center">
               <Settings size={32} className="text-[var(--text-muted)] opacity-30 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mb-2">Account Configuration</h3>
            <p className="text-[var(--text-muted)] max-w-prose text-sm md:text-base leading-relaxed">
              Use the sidebar to navigate your settings. Your profile operates on a unified cross-platform account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
