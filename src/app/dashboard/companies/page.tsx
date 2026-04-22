'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2 } from 'lucide-react';


export default function CompaniesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies);
      } else {
        throw new Error('Failed to load');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadCompanies();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsCreating(false);
      setNewCompanyName('');
      loadCompanies();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex h-screen items-center justify-center text-gray-900 dark:text-gray-100">Loading...</div>;
  }

  return (
    <div className="space-y-10 md:space-y-12 lg:space-y-16 bg-slate-950 min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8 overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8 border-b border-slate-900 pb-6 md:pb-10 lg:pb-12">
        <div>
          <div className="flex items-center gap-4 mb-6">
             <div className="w-2 h-10 bg-indigo-600 rounded-full"></div>
             <span className="text-sm font-bold text-indigo-400 uppercase tracking-[0.4em]">Organization Manifest</span>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white uppercase italic leading-snug">Your Companies</h1>
          <p className="mt-4 md:mt-6 lg:mt-8 text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-prose">
             Manage the spatial intelligence workspaces for your architectural and engineering entities.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className={`px-6 md:px-8 lg:px-10 py-3 md:py-4 min-h-11 w-full md:w-auto rounded-2xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all shadow-2xl active:scale-95 ${
            isCreating 
            ? 'bg-slate-900 text-slate-400 border border-slate-800' 
            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20'
          }`}
        >
          {isCreating ? 'Abort Creation' : 'Register New Entity'}
        </button>
      </div>

        {error && <div className="text-red-400 mb-8 bg-red-400/10 border border-red-400/20 p-4 md:p-6 lg:p-8 rounded-[32px] text-sm font-bold uppercase tracking-widest">{error}</div>}

        {isCreating && (
          <form onSubmit={handleCreate} className="bg-slate-900/40 backdrop-blur-xl p-4 md:p-6 lg:p-8 rounded-[32px] lg:rounded-[48px] border border-slate-800/50 shadow-2xl mb-12 md:mb-16 lg:mb-20 animate-in slide-in-from-top-6 duration-700">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12 items-end">
              <div className="flex-1 space-y-6">
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest ml-1 italic">Entity Designation</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full rounded-[24px] border-slate-800 bg-slate-950 shadow-inner text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-5 py-3 min-h-11 border transition-all outline-none text-sm md:text-base font-medium italic"
                  placeholder="Enter legal or project entity name..."
                  required
                  minLength={2}
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 text-white px-6 md:px-8 py-3 min-h-11 w-full md:w-auto rounded-2xl text-sm md:text-base font-bold uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-900/20 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {creating ? 'Processing...' : 'Authorize Entity'}
              </button>
            </div>
          </form>
        )}

        {companies.length === 0 ? (
          <div className="text-center py-16 md:py-24 lg:py-32 bg-slate-900/20 backdrop-blur-md rounded-[48px] border border-slate-800/50 shadow-2xl">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl mx-auto mb-8 border border-slate-800 flex items-center justify-center">
               <Building2 className="text-slate-600" size={40} />
            </div>
            <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-white uppercase italic tracking-wider leading-snug">No active entities detected</h3>
            <p className="mt-4 text-slate-500 text-sm uppercase tracking-widest font-bold">Register a company to initiate spatial diagnostics</p>
          </div>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <a
                key={c.id}
                href={`/dashboard/companies/${c.id}`}
                className="bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-slate-800/50 p-4 md:p-6 lg:p-8 hover:border-indigo-500/50 transition-all block group relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
                <h3 className="text-lg md:text-xl lg:text-2xl font-black text-white italic uppercase tracking-tight mb-6 group-hover:text-indigo-400 transition-colors leading-snug">{c.name}</h3>
                <div className="text-xs font-bold text-slate-500 flex items-center justify-between uppercase tracking-widest mt-10 md:mt-12 lg:mt-16 border-t border-slate-800/50 pt-6 md:pt-8 lg:pt-10 gap-4">
                  <span className="flex items-center gap-4">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    {c._count.members} Members Online
                  </span>
                  <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2">Access Surface &rarr;</span>
                </div>
              </a>
            ))}
          </div>
        )}
    </div>
  );


}