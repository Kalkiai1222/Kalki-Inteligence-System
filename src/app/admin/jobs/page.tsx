'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Briefcase, Search, Filter, Layers, Clock, CheckCircle2, ChevronLeft, MapPin } from 'lucide-react';

export default function AdminJobsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchJobs = async (query = '', status = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`);
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json();
      setJobs(data.jobs);
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const timeoutId = setTimeout(() => fetchJobs(search, statusFilter), 300);
      return () => clearTimeout(timeoutId);
    }
  }, [user, search, statusFilter]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">Loading Jobs Activity...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'COMPLETED':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</span>;
        case 'IN_PROGRESS':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800"><Clock className="w-3 h-3 mr-1" />In Progress</span>;
        default:
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">Pending</span>;
    }
  };

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
                <Briefcase className="w-8 h-8 mr-3 text-indigo-500" />
                Work Jobs & Operations
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Global oversight of all organization construction tasks.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:max-w-40">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  className="block w-full rounded-md border-0 py-2 pl-10 pr-8 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-colors shadow-sm appearance-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-colors shadow-sm"
                  placeholder="Search jobs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
          </div>
        </div>

        {error && <div className="text-red-500 mb-6 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">{error}</div>}

        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
            {loading ? (
                <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading operations map...</div>
            ) : jobs.length === 0 ? (
                <div className="p-10 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                    <Briefcase className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                    <p>No operational jobs match your criteria.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                        <thead className="bg-gray-50 dark:bg-slate-800/50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Job Summary</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Organization & Project</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Materials Pipeline</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {jobs.map((j) => (
                                <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                        <div className="font-medium text-gray-900 dark:text-white">{j.name}</div>
                                        {j.description && <div className="text-gray-500 dark:text-gray-400 max-w-xs truncate mt-0.5" title={j.description}>{j.description}</div>}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                {j.project?.company?.name || 'Unknown Company'}
                                            </span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-4">
                                                &#8627; {j.project?.name || 'Unknown Project'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        {getStatusBadge(j.status)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center">
                                            <Layers className="w-4 h-4 mr-2 text-slate-400" />
                                            {j._count.materials} tracked material(s)
                                        </div>
                                    </td>
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                        <a href={`/admin/jobs/${j.id}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 focus:outline-none focus:underline border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 px-3 py-1 rounded transition-colors bg-white dark:bg-slate-800 shadow-sm">
                                           Inspect Data
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}