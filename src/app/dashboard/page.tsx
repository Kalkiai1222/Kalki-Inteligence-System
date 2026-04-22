'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-full bg-slate-950 min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8 overflow-x-hidden">
      <main className="mx-auto max-w-7xl space-y-10 md:space-y-12 lg:space-y-16">
        
        {/* Cinematic Welcome Header */}
        <div className="flex flex-col relative rounded-[32px] lg:rounded-[40px] overflow-hidden bg-slate-900 px-4 py-6 md:px-6 md:py-10 lg:px-8 lg:py-12 shadow-2xl border border-slate-800">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888081622-4a7cf5957b40?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-10 mix-blend-luminosity"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-transparent"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
             <div>
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-2.5 h-10 bg-indigo-600 rounded-full"></div>
                   <span className="text-sm font-bold text-indigo-400 uppercase tracking-[0.4em]">System Interface Online</span>
                </div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white mb-4 md:mb-6 uppercase italic flex items-center gap-6 leading-snug">
                  Welcome, {user.name?.split(' ')[0] || 'Engineer'}
                </h1>
                <p className="text-slate-400 max-w-prose text-sm md:text-base font-medium leading-relaxed">
                  Kalki Intelligence is active. Your current session is authenticated under <span className="text-indigo-300 font-mono italic">{user.email}</span>. Prepare for deterministic spatial analysis.
                </p>
             </div>
             <button 
                onClick={() => router.push('/dashboard/jobs')}
                className="bg-indigo-600 text-white px-6 py-3 min-h-11 w-full md:w-auto rounded-2xl text-sm md:text-base font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-900/20 active:scale-95"
             >
                Initiate New Analysis
             </button>
          </div>
        </div>

        {/* Diagnostic Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12">
           <div className="bg-slate-900/40 backdrop-blur-xl rounded-[40px] p-4 md:p-6 lg:p-8 border border-slate-800/50 shadow-2xl flex flex-col">
              <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white uppercase tracking-widest mb-6 md:mb-8 lg:mb-12 flex items-center gap-4 italic leading-snug">
                 <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                 Account Credentials
              </h2>
              <dl className="space-y-6 md:space-y-8 lg:space-y-10">
                {[
                  { label: 'Identifier', value: user.name || 'Not provided' },
                  { label: 'Secure Email', value: user.email },
                  { label: 'Security Status', value: user.emailVerified ? 'Verified' : 'Pending', isBadge: true }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-900 pb-4 md:pb-6 lg:pb-8 last:border-0">
                    <dt className="text-sm font-bold text-slate-500 uppercase tracking-widest">{item.label}</dt>
                    <dd className="text-sm md:text-base">
                       {item.isBadge ? (
                         <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest inline-flex items-center justify-center min-h-11 ${item.value === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                           {item.value}
                         </span>
                       ) : (
                         <span className="text-white font-black italic uppercase tracking-tight">{item.value}</span>
                       )}
                    </dd>
                  </div>
                ))}
              </dl>
           </div>

           <div className="bg-slate-900/40 backdrop-blur-xl rounded-[40px] p-4 md:p-6 lg:p-8 border border-slate-800/50 shadow-2xl flex flex-col justify-center items-center text-center space-y-8 md:space-y-10 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-indigo-600/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
              <div className="w-24 h-24 rounded-[32px] bg-slate-950 flex items-center justify-center border border-slate-800 shadow-2xl group-hover:border-indigo-500 transition-all cursor-pointer">
                 <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-white uppercase italic tracking-wider leading-snug">Spatial Fleet Status</h3>
                <p className="text-slate-500 text-sm md:text-base max-w-prose leading-relaxed font-medium">
                   You have no active structural jobs. Upload a 2D blueprint to begin the volumetric reconstruction process.
                </p>
              </div>
              <button 
                onClick={() => router.push(`/dashboard/companies`)}
                className="text-sm font-bold text-indigo-400 uppercase tracking-[0.3em] hover:text-indigo-300 transition-colors flex items-center gap-3 group/btn"
              >
                 Access All Projects <span className="group-hover:translate-x-2 transition-transform">&rarr;</span>
              </button>
           </div>
        </div>
      </main>
    </div>
  );

}
