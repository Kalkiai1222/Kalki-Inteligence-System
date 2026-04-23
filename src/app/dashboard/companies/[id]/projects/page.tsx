'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ProjectsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCreatingProj, setIsCreatingProj] = useState(false);
  const [projForm, setProjForm] = useState({ name: '', description: '', status: 'PLANNING', clientId: '' });

  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/companies/${id}/projects`),
        fetch(`/api/companies/${id}/clients`)
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      
      setProjects(pData.projects);
      setClients(cData.clients);
    } catch (err: any) {
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) loadData();
  }, [user, id]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim()) return;
    try {
      const res = await fetch(`/api/companies/${id}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsCreatingClient(false);
      setClientForm({ name: '', email: '', phone: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projForm.name.trim()) return;
    try {
      const res = await fetch(`/api/companies/${id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsCreatingProj(false);
      setProjForm({ name: '', description: '', status: 'PLANNING', clientId: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="h-12 w-64 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/2 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">Error Loading Projects</h3>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <a href={`/dashboard/companies/${id}`} className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 font-medium">&larr; Go back</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300 py-10 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
      <div className="max-w-6xl mx-auto space-y-8 mt-5">
        
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 bg-white dark:bg-slate-900 transition-colors p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Projects</h1>
            <a href={`/dashboard/companies/${id}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium transition-colors">&larr; Back to Company Dashboard</a>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
             <button onClick={() => setIsCreatingClient(!isCreatingClient)} className="w-full sm:w-auto bg-white dark:bg-slate-800 transition-colors text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg font-medium border border-gray-300 dark:border-slate-700 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200">
               {isCreatingClient ? '✕ Close' : '+ Add Client'}
             </button>
             <button onClick={() => setIsCreatingProj(!isCreatingProj)} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all duration-200 hover:shadow-md">
               {isCreatingProj ? '✕ Close' : '+ New Project'}
             </button>
          </div>
        </div>

        {isCreatingClient && (
          <form onSubmit={handleCreateClient} className="bg-white dark:bg-slate-900 transition-colors p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Add New Client</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Create a new client organization</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Client Name</label>
                <input type="text" required value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" placeholder="Acme Corp" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label><input type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-700 px-3 py-2 border shadow-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Phone</label><input type="text" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-700 px-3 py-2 border shadow-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500" /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-semibold text-sm transition-all duration-200 hover:shadow-md">Save Client</button>
              <button type="button" onClick={() => setIsCreatingClient(false)} className="flex-1 bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 font-semibold text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {isCreatingProj && (
          <form onSubmit={handleCreateProject} className="bg-white dark:bg-slate-900 transition-colors p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Create New Project</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Start a new construction project</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Project Name</label>
                <input type="text" required value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" placeholder="Main Building Renovation" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Client</label>
                <select value={projForm.clientId} onChange={e => setProjForm({...projForm, clientId: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all">
                  <option value="">No Client (Internal)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={projForm.description} onChange={e => setProjForm({...projForm, description: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" placeholder="Describe the project scope..." rows={3} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-semibold text-sm transition-all duration-200 hover:shadow-md">Create Project</button>
              <button type="button" onClick={() => setIsCreatingProj(false)} className="flex-1 bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 font-semibold text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 ? (
            <div className="col-span-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
              <p className="text-blue-900 dark:text-blue-300 font-medium">No projects yet</p>
              <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">Click "New Project" above to create your first project</p>
            </div>
          ) : projects.map((p) => (
            <a key={p.id} href={`/dashboard/companies/${id}/projects/${p.id}`} className="bg-white dark:bg-slate-900 transition-colors rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all duration-200 group">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.name}</h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ p.status === 'PLANNING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' : p.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-300' }`}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-4 h-10 overflow-hidden line-clamp-2">{p.description || 'No description provided'}</p>
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-between border-t border-gray-200 dark:border-slate-800 pt-4">
                <span className="font-medium">{p.client ? p.client.name : 'Internal Project'}</span>
                <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full text-xs font-semibold">{p._count.blueprintSets} Folders</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}