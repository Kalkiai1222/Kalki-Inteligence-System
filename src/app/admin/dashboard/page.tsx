'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Users, Briefcase, Building2, TrendingUp, ChevronRight } from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Failed to load statistics');
        const data = await res.json();
        setStats(data.stats);
      } catch (err: any) {
        setError(err.message || 'Error occurred');
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchStats();
  }, [user]);

  if (authLoading || loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">Loading Admin Dashboard...</div>;
  }

  const statCards = stats ? [
    { name: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { name: 'Total Companies', value: stats.companies, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { name: 'Total Jobs', value: stats.jobs.total, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    { name: 'Total Revenue Volume', value: `$${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' }
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto relative">
        <div className="absolute top-0 right-0 z-10 flex gap-4 items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Logged in as {user?.email}</span>
          <ThemeToggle />
        </div>
        
        <div className="mb-4">
          <a href="/dashboard" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">&larr; Back to App Dashboard</a>
        </div>
        
        <div className="flex justify-between items-end mb-8 border-b border-gray-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Admin Console</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage all platforms users, companies, jobs, and organizational revenue.</p>
          </div>
        </div>

        {error && <div className="text-red-500 mb-6 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">{error}</div>}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {statCards.map((stat) => (
            <div key={stat.name} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 p-6 flex flex-col justify-between group hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`rounded-lg p-3 ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} aria-hidden="true" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{stat.name}</p>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-gray-100 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Management Routes</h2>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-slate-800">
                    <li className="py-4">
                        <a href="/admin/users" className="flex items-center justify-between group">
                            <div className="flex items-center space-x-4">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-indigo-600 dark:text-indigo-400">
                                    <Users className="w-5 h-5"/>
                                </div>
                                <span className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Users Directory</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                        </a>
                    </li>
                    <li className="py-4">
                        <a href="/admin/companies" className="flex items-center justify-between group">
                            <div className="flex items-center space-x-4">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-indigo-600 dark:text-indigo-400">
                                    <Building2 className="w-5 h-5"/>
                                </div>
                                <span className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Company Organizations</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                        </a>
                    </li>
                    <li className="py-4">
                        <a href="/admin/jobs" className="flex items-center justify-between group">
                            <div className="flex items-center space-x-4">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-indigo-600 dark:text-indigo-400">
                                    <Briefcase className="w-5 h-5"/>
                                </div>
                                <span className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Job & Project Tracking</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                        </a>
                    </li>
                </ul>
            </div>
            
            <div className="bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-gray-100 dark:border-slate-800 p-6 flex flex-col justify-center items-center text-center">
                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full mb-4">
                    <TrendingUp className="w-10 h-10 text-indigo-600 dark:text-indigo-400"/>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Platform Revenue Insights</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">Revenue metrics are derived from active and completed jobs, aggregated across all managed organizations and user workspaces.</p>
                <div className="mt-6 flex justify-center gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-bold flex flex-col items-center">
                        <span>Active Jobs</span>
                        <span className="text-xl mt-1">{stats?.jobs?.active || 0}</span>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm font-bold flex flex-col items-center">
                        <span>Completed</span>
                        <span className="text-xl mt-1">{stats?.jobs?.completed || 0}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}