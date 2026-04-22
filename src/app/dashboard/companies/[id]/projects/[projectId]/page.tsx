'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

import { MultiFileUploader } from './MultiFileUploader';
import { JobsList } from './JobsList';
import { MaterialsList } from './MaterialsList';

export default function ProjectDetailsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const projectId = params.projectId as string;
  
  const [project, setProject] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isEditing, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadProject = async () => {
    try {
      const res = await fetch(`/api/companies/${id}/projects/${projectId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProject(data.project);
    } catch (err: any) {
      setError(err.message || 'Error loading project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id && projectId) loadProject();
  }, [user, id, projectId]);

  const handleUpdateStatus = async (status: string) => {
    try {
      await fetch(`/api/companies/${id}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...project, status, clientId: project.clientId })
      });
      loadProject();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/companies/${id}/projects/${projectId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/dashboard/companies/${id}/projects`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="h-12 w-64 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded w-1/3 animate-pulse"></div>
                <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded w-1/2 animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-slate-800 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">Error Loading Project</h3>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <a href={`/dashboard/companies/${id}/projects`} className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 font-medium">&larr; Back to Projects</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 -ml-20 -mt-20 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto space-y-10 md:space-y-12 lg:space-y-16 mt-5 relative z-10">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 md:gap-10 bg-slate-900/40 backdrop-blur-xl transition-all p-4 md:p-6 lg:p-8 rounded-[40px] shadow-2xl border border-slate-800/50">
          <div className="flex-1">
            <a href={`/dashboard/companies/${id}/projects`} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-[0.3em] inline-block mb-6 transition-colors">&larr; Return to Fleet</a>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 mb-6">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight uppercase italic flex items-center gap-4 leading-snug">
                 <span className="w-1.5 h-10 bg-indigo-600 rounded-sm"></span>
                 {project.name}
              </h1>
              <select value={project.status} onChange={e => handleUpdateStatus(e.target.value)} className="self-start md:self-center text-xs font-bold px-4 py-3 min-h-11 rounded-xl border border-slate-800 shadow-xl text-white bg-slate-950 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-widest">
                 <option value="PLANNING">Planning</option>
                 <option value="ACTIVE">Active</option>
                 <option value="ON_HOLD">On Hold</option>
                 <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <p className="text-slate-400 mt-4 max-w-prose text-sm md:text-base font-medium leading-relaxed">{project.description}</p>
            {project.client && <p className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-full inline-block mt-8 border border-indigo-500/20 uppercase tracking-widest italic">📋 Client Entity: {project.client.name}</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">
             <button onClick={() => setIsUploading(!isUploading)} className="bg-indigo-600 text-white px-6 py-3 min-h-11 w-full sm:w-auto rounded-2xl text-sm md:text-base font-bold uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-900/20 transition-all active:scale-95">
               {isUploading ? 'Abort Upload' : 'Deploy Blueprints'}
             </button>
             <button onClick={handleDeleteProject} className="bg-slate-950 text-red-400 border border-red-500/20 px-6 py-3 min-h-11 w-full sm:w-auto rounded-2xl text-sm md:text-base font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all shadow-xl">Purge Project</button>
          </div>
        </div>

        {isUploading && (
          <MultiFileUploader 
            companyId={id} 
            projectId={projectId} 
            onUploadSuccess={() => {
              setIsUploading(false);
              loadProject();
            }} 
          />
        )}

        <div className="bg-slate-900/40 backdrop-blur-xl transition-all shadow-2xl rounded-[40px] overflow-hidden border border-slate-800/50">
           <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 border-b border-slate-800 bg-slate-900/50 transition-colors duration-300 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
             <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white uppercase italic tracking-wider leading-snug">Spatial Blueprint Sets</h2>
             <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Index: {project.blueprintSets.length} Entities</span>
           </div>
           <div className="p-4 md:p-6 lg:p-10">
             {project.blueprintSets.length === 0 ? (
               <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-[32px] p-8 md:p-12 lg:p-16 text-center">
                 <p className="text-indigo-300 font-bold uppercase tracking-widest text-lg md:text-xl">No blueprints indexed</p>
                 <p className="text-slate-500 text-sm mt-4 font-medium uppercase tracking-widest">Execute "Deploy Blueprints" to initiate spatial reconstruction</p>
               </div>
             ) : (
               <div className="space-y-10">
                 {project.blueprintSets.map((set: any) => (
                   <div key={set.id} className="border border-slate-800/50 rounded-[32px] shadow-2xl overflow-hidden bg-slate-950/20">
                     <div className="px-8 py-6 bg-slate-900/40 transition-colors border-b border-slate-800 flex justify-between items-center">
                       <h4 className="font-black text-white uppercase italic tracking-tight text-xl">{set.name}</h4>
                       <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">v{set.versions[0]?.versionNumber}</span>
                     </div>
                     <div className="p-8 space-y-6">
                       {set.versions.map((v: any, index: number) => (
                         <div key={v.id} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-8 border rounded-[24px] transition-all group ${ index === 0 ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-slate-950/40 border-slate-800'}`}>
                           <div className="flex-1">
                             <div className="flex items-center gap-4 mb-2">
                                <p className="text-lg font-black text-white italic uppercase tracking-tight">Version {v.versionNumber}</p>
                                {index === 0 && <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">Latest Diagnostic</span>}
                             </div>
                             <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">{new Date(v.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                             <p className="text-base text-slate-400 mt-4 font-medium leading-relaxed italic">{v.notes || 'No technical notes provided for this spatial state.'}</p>
                           </div>
                           <a href={`/dashboard/companies/${id}/projects/${projectId}/blueprints/v/${v.id}`} className="mt-6 md:mt-0 md:ml-8 whitespace-nowrap text-sm md:text-base font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 min-h-11 rounded-2xl hover:bg-indigo-500/20 transition-all duration-300 uppercase tracking-widest text-center">Analyze Surface &rarr;</a>
                         </div>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        </div>

        <JobsList companyId={id} projectId={projectId} />
        
        <MaterialsList companyId={id} projectId={projectId} />
      </div>
    </div>
  );
}