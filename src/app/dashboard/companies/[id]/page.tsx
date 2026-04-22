'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CompanyAnalytics } from './AnalyticsDashboard';
import { NotificationsDropdown } from './NotificationsDropdown';

export default function CompanyDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadCompany = async () => {
    try {
      const res = await fetch(`/api/companies/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCompany(data.company);
      } else {
        throw new Error('Failed to load company details');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading company');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) loadCompany();
  }, [user, id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/companies/${id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setInviteEmail('');
      setInviteRole('MEMBER');
      loadCompany();
      alert('Invitation sent successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/companies/${id}/members/${memberId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadCompany();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const amIAdmin = company?.members.some((m: any) => m.userId === user?.id && m.role === 'ADMIN');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="h-12 w-64 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">Error Loading Company</h3>
            <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
            <a href="/dashboard/companies" className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 font-medium">&larr; Go back to companies</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 relative overflow-x-hidden">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 bg-white dark:bg-slate-900 transition-colors p-4 md:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-snug">{company.name}</h1>
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Company Dashboard</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <NotificationsDropdown companyId={id} />
            <a href={`/dashboard/companies/${id}/projects`} className="bg-indigo-600 text-white px-5 py-3 min-h-11 rounded-md font-medium hover:bg-indigo-700 shadow-sm inline-flex items-center justify-center transition-colors text-sm md:text-base">
              Project Workspace
            </a>
            {amIAdmin && (
              <a href={`/dashboard/companies/${id}/audit`} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors text-sm md:text-base inline-flex items-center min-h-11">
                Audit Logs
              </a>
            )}
            <a href="/dashboard/companies" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 inline-flex items-center font-medium transition-colors text-sm md:text-base min-h-11">&larr; Back</a>
          </div>
        </div>

        <CompanyAnalytics company={company} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="bg-white dark:bg-slate-900 transition-colors rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Team Members</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{company.members.length} member{company.members.length !== 1 ? 's' : ''}</p>
              </div>
              {company.members.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">No members yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-slate-800">
                  {company.members.map((m: any) => (
                    <li key={m.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{m.user.name || m.user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{m.role}</span>
                        </div>
                      </div>
                      {amIAdmin && m.userId !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {amIAdmin && company.invites.length > 0 && (
              <div className="bg-white dark:bg-slate-900 transition-colors rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pending Invitations</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{company.invites.length} pending invite{company.invites.length !== 1 ? 's' : ''}</p>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-slate-800">
                  {company.invites.map((inv: any) => (
                    <li key={inv.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{inv.email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role: <span className="font-semibold">{inv.role}</span> • Expires: {new Date(inv.expiresAt).toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 whitespace-nowrap">Pending</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="md:col-span-1">
            {amIAdmin && (
              <form onSubmit={handleInvite} className="bg-white dark:bg-slate-900 transition-colors p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 space-y-5 sticky top-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Invite Team Member</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Send an invitation to a new team member</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all"
                    placeholder="colleague@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-all duration-200 hover:shadow-md"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </form>
            )}
            
            {!amIAdmin && (
               <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-6 rounded-xl text-center">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">You are a member</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">Only workspace admins can invite new users</p>
               </div>
            )}
          </div>
        </div>
    </div>
  );
}