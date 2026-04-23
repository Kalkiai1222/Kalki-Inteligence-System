import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Package, Plus, Truck, Receipt } from 'lucide-react';

interface MaterialsListProps {
  companyId: string;
  projectId: string;
}

export function MaterialsList({ companyId, projectId }: MaterialsListProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]); // To let users link materials to jobs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: '', unit: '', cost: '', jobId: '' });

  const loadData = async () => {
    try {
      const [matRes, jobRes] = await Promise.all([
        fetch(`/api/companies/${companyId}/projects/${projectId}/materials`),
        fetch(`/api/companies/${companyId}/projects/${projectId}/jobs`)
      ]);
      
      const matData = await matRes.json();
      const jobData = await jobRes.json();
      
      if (!matRes.ok) throw new Error(matData.error);
      if (!jobRes.ok) throw new Error(jobData.error);

      setMaterials(matData.materials);
      setJobs(jobData.jobs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId && projectId) loadData();
  }, [companyId, projectId]);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.name.trim() || !newMaterial.quantity || !newMaterial.unit) return;

    try {
      const res = await fetch(`/api/companies/${companyId}/projects/${projectId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaterial)
      });
      if (!res.ok) throw new Error('Failed to order material');
      
      setNewMaterial({ name: '', quantity: '', unit: '', cost: '', jobId: '' });
      setIsCreating(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return (
    <div className="bg-white dark:bg-slate-900 transition-colors p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
      <div className="h-6 w-56 bg-gray-200 dark:bg-slate-800 rounded animate-pulse mb-4"></div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-slate-800 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
  );
  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-xl">
      <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 transition-colors rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 transition-colors flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Procurement & Inventory</h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 px-3 py-2 rounded-lg font-semibold transition-all duration-200"
        >
          <Plus className="w-4 h-4" /> {isCreating ? 'Cancel' : 'Add Material'}
        </button>
      </div>

      {isCreating && (
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30">
          <form onSubmit={handleCreateMaterial} className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Material Name</label>
                <input type="text" className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="e.g. Concrete Type IV" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                  <input type="number" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unit</label>
                  <input type="text" className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} placeholder="tons, sqft" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Cost Estimate ($)</label>
                <input type="number" step="0.01" className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" value={newMaterial.cost} onChange={e => setNewMaterial({...newMaterial, cost: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Link to Job</label>
                <select className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:focus:ring-indigo-400 transition-all" value={newMaterial.jobId} onChange={e => setNewMaterial({...newMaterial, jobId: e.target.value})}>
                  <option value="">-- No specific Job --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-semibold text-sm transition-all duration-200 hover:shadow-md">Submit Request</button>
              <button type="button" onClick={() => { setIsCreating(false); setNewMaterial({ name: '', quantity: '', unit: '', cost: '', jobId: '' }); }} className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-semibold text-sm transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Item</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Job</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Status</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {materials.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center">
                <div className="flex flex-col items-center justify-center">
                  <Truck className="w-8 h-8 text-gray-400 dark:text-gray-600 mb-2" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium">No materials requested yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Click "Add Material" to create procurement requests</p>
                </div>
              </td></tr>
            ) : (
              materials.map(mat => (
                <tr key={mat.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{mat.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{mat.quantity} {mat.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {mat.job ? (
                      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-full inline-flex items-center gap-1 border border-indigo-200 dark:border-indigo-800/50"><Receipt className="w-3 h-3" /> {mat.job.name}</span>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full inline-block ${ mat.status === 'DELIVERED' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : mat.status === 'ORDERED' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}`}>
                      {mat.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">
                    {mat.cost ? `$${mat.cost.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}