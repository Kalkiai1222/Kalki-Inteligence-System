'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Building2, Search, Users, Shield, Calendar, BarChart3, ChevronLeft } from 'lucide-react';

export default function AdminCompaniesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchCompanies = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to load companies');
      const data = await res.json();
      setCompanies(data.companies);
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const timeoutId = setTimeout(() => fetchCompanies(search), 300);
      return () => clearTimeout(timeoutId);
    }
  }, [user, search]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">Loading Organizations...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto relative">
        <div className="absolute top-0 right-0 z-10 flex gap-4 items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin Mode</span>
            <ThemeToggle />
        </div>
        
        <div className="mb-4">
          <a href="/admin/dashboard" className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Admin Hub
          </a>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-gray-200 dark:border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center">
                <Building2 className="w-8 h-8 mr-3 text-indigo-500" />
                Organizations
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">View and regulate multi-tenant workspaces.</p>
          </div>
          
          <div className="relative w-full sm:max-w-xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-colors shadow-sm"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="text-red-500 mb-6 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
                <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-slate-800 rounded-xl">Pulling data...</div>
            ) : companies.length === 0 ? (
                <div className="col-span-full py-12 bg-white dark:bg-slate-900 shadow-sm border border-gray-200 dark:border-slate-800 rounded-xl text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                    <Building2 className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                    <p>No organizations found.</p>
                </div>
            ) : (
                companies.map((c) => (
                    <div key={c.id} className="bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 p-6 rounded-xl hover:shadow-md dark:hover:shadow-indigo-900/20 transition-all flex flex-col justify-between group">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{c.name}</h3>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg">
                                    <BarChart3 className="w-5 h-5"/>
                                </div>
                            </div>
                            
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <Users className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                                    <span><strong>{c._count.members}</strong> active teammates</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <Building2 className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                                    <span><strong>{c._count.projects}</strong> total projects</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <Calendar className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                                    <span>Established <strong>{new Date(c.createdAt).toLocaleDateString()}</strong></span>
                                </div>
                                {c.members?.length > 0 && (
                                    <div className="flex items-start bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg mt-4 border border-gray-100 dark:border-slate-800">
                                        <Shield className="w-4 h-4 mr-2 text-indigo-500 shrink-0 mt-0.5" />
                                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                            <span className="font-semibold text-gray-900 dark:text-gray-200 block mb-0.5">Primary Admin:</span>
                                            {c.members[0].user?.name || c.members[0].user?.email}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800 mt-auto">
                            <a href={`/admin/companies/${c.id}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-sm w-full flex justify-center py-2 px-4 rounded-md transition-colors bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 text-center">
                                Detailed Inspection &rarr;
                            </a>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
}