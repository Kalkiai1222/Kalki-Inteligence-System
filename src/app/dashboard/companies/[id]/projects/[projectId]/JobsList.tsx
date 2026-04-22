import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Clock, PlayCircle, Plus } from 'lucide-react';

interface JobsListProps {
  companyId: string;
  projectId: string;
}

export function JobsList({ companyId, projectId }: JobsListProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');

  const loadJobs = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/projects/${projectId}/jobs`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobs(data.jobs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId && projectId) loadJobs();
  }, [companyId, projectId]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName.trim()) return;

    try {
      const res = await fetch(`/api/companies/${companyId}/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newJobName, description: newJobDesc })
      });
      if (!res.ok) throw new Error('Failed to create job');
      
      setNewJobName('');
      setNewJobDesc('');
      setIsCreating(false);
      loadJobs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return (
    <div className="bg-white dark:bg-slate-900 transition-colors p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
      <div className="h-6 w-40 bg-gray-200 dark:bg-slate-800 rounded animate-pulse mb-4"></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-200 dark:bg-slate-800 rounded-lg h-32 animate-pulse"></div>
        ))}
      </div>
    </div>
  );
  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-xl">
      <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
    </div>
  );

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'COMPLETED': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'IN_PROGRESS': return <PlayCircle className="w-5 h-5 text-blue-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 transition-colors rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 transition-colors flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Project Jobs</h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 text-sm md:text-base bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 px-5 py-3 min-h-11 rounded-lg font-semibold transition-all duration-200"
        >
          <Plus className="w-4 h-4" /> {isCreating ? 'Cancel' : 'Add Job'}
        </button>
      </div>

      {isCreating && (
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30">
          <form onSubmit={handleCreateJob} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Job Name</label>
              <input 
                type="text" 
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 min-h-11 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" 
                placeholder="e.g., Framing, Electrical, Plumbing"
                value={newJobName} 
                onChange={e => setNewJobName(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
              <textarea 
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all resize-none" 
                rows={2}
                placeholder="Describe the job scope and requirements..."
                value={newJobDesc} 
                onChange={e => setNewJobDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-indigo-600 text-white px-5 py-3 min-h-11 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-semibold text-sm md:text-base transition-all duration-200 hover:shadow-md">Create Job</button>
              <button type="button" onClick={() => { setIsCreating(false); setNewJobName(''); setNewJobDesc(''); }} className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white px-5 py-3 min-h-11 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-semibold text-sm md:text-base transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="p-6">
        {jobs.length === 0 ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
            <p className="text-blue-900 dark:text-blue-300 font-medium">No jobs yet</p>
            <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">Create your first job to organize project work</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-lg dark:hover:shadow-lg transition-all duration-200 hover:border-indigo-200 dark:hover:border-indigo-800/50 flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate pr-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{job.name}</h3>
                    <div title={job.status} className="flex-shrink-0">{getStatusIcon(job.status)}</div>
                  </div>
                  {job.description && <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{job.description}</p>}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600 flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{format(new Date(job.createdAt), 'MMM d, yyyy')}</span>
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold px-2.5 py-1 rounded-full">
                    {job.materials?.length || 0} items
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}