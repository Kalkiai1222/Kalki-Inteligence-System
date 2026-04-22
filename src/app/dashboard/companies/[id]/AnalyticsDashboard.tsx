'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, parseISO, isAfter } from 'date-fns';
import { Activity, Layers, Briefcase, FileSignature, FolderKanban } from 'lucide-react';

interface AnalyticsProps {
  company: any;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#ef4444'];

export function CompanyAnalytics({ company }: AnalyticsProps) {
  const { projects = [], clients = [], members = [] } = company;

  const stats = useMemo(() => {
    let totalBlueprints = 0;
    let totalFilesSize = 0;
    let activeProjects = 0;
    let completedProjects = 0;

    projects.forEach((proj: any) => {
      if (proj.status === 'ACTIVE') activeProjects++;
      if (proj.status === 'COMPLETED') completedProjects++;

      proj.blueprintSets.forEach((set: any) => {
        set.versions.forEach((v: any) => {
          totalBlueprints++;
          if (v.fileSize) totalFilesSize += v.fileSize;
        });
      });
    });

    const fileStorageMb = (totalFilesSize / 1024 / 1024).toFixed(2);

    // Chart 1: Project status pie
    const projectStatusData = [
      { name: 'Active', value: activeProjects },
      { name: 'Planning', value: projects.filter((p: any) => p.status === 'PLANNING').length },
      { name: 'Completed', value: completedProjects },
      { name: 'On Hold', value: projects.filter((p: any) => p.status === 'ON_HOLD').length }
    ].filter(d => d.value > 0);

    // Chart 2: Blueprint Growth over last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30);
    const dateMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM dd');
      dateMap[d] = 0;
    }

    projects.forEach((p: any) => {
      p.blueprintSets.forEach((set: any) => {
        set.versions.forEach((v: any) => {
          if (!v.createdAt) return;
          const created = parseISO(v.createdAt);
          if (isAfter(created, thirtyDaysAgo)) {
            const dayKey = format(created, 'MMM dd');
            if (dateMap[dayKey] !== undefined) dateMap[dayKey]++;
          }
        });
      });
    });

    const uploadActivityData = Object.keys(dateMap).map(date => ({
      date,
      uploads: dateMap[date]
    }));

    return {
      activeProjects,
      totalBlueprints,
      fileStorageMb,
      totalClients: clients.length,
      projectStatusData,
      uploadActivityData,
      totalProjects: projects.length,
      totalMembers: members.length
    };
  }, [projects, clients, members]);

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 flex p-5 items-center gap-4">
           <div className="p-3 bg-indigo-50 rounded-lg"><Briefcase className="h-6 w-6 text-indigo-600" /></div>
           <div>
             <p className="text-sm font-medium text-gray-500 truncate">Active Projects</p>
             <p className="mt-1 text-2xl font-bold text-gray-900">{stats.activeProjects} <span className="text-sm text-gray-400 font-normal">/ {stats.totalProjects} total</span></p>
           </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 flex p-5 items-center gap-4">
           <div className="p-3 bg-green-50 rounded-lg"><FolderKanban className="h-6 w-6 text-green-600" /></div>
           <div>
             <p className="text-sm font-medium text-gray-500 truncate">Total Clients</p>
             <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalClients}</p>
           </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 flex p-5 items-center gap-4">
           <div className="p-3 bg-amber-50 rounded-lg"><FileSignature className="h-6 w-6 text-amber-600" /></div>
           <div>
             <p className="text-sm font-medium text-gray-500 truncate">Files Synced</p>
             <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalBlueprints}</p>
           </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 flex p-5 items-center gap-4">
           <div className="p-3 bg-red-50 rounded-lg"><Layers className="h-6 w-6 text-red-600" /></div>
           <div>
             <p className="text-sm font-medium text-gray-500 truncate">Storage Used</p>
             <p className="mt-1 text-2xl font-bold text-gray-900">{stats.fileStorageMb} MB</p>
           </div>
        </div>
      </div>

      {/* Real Charts Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Activity Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-400" /> 30-Day Storage Activity
            </h3>
            <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded text-gray-600">Files Uploaded</span>
          </div>
          <div className="h-72 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.uploadActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#4f46e5', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="uploads" name="Blueprints" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorUploads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Balance */}
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Project Portfolio</h3>
          {stats.projectStatusData.length > 0 ? (
            <div className="h-56 mt-4 relative w-full min-h-[224px]">
              <ResponsiveContainer width="100%" height={224}>
                <PieChart>
                  <Pie
                    data={stats.projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                <span className="text-3xl font-bold text-gray-900">{stats.totalProjects}</span>
                <span className="text-xs text-gray-500">Projects</span>
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center flex-col text-gray-400">
               <Briefcase className="w-10 h-10 mb-2 opacity-50" />
               <p className="text-sm">No projects active</p>
            </div>
          )}
          
          <div className="mt-6 space-y-2">
            {stats.projectStatusData.map((s, i) => (
              <div key={s.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-gray-600">{s.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}