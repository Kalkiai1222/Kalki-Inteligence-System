'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ExportReportsMenu from '@/components/ExportReportsMenu';

const Blueprint3DViewer = dynamic(
  () => import('@/components/Blueprint3DViewer'),
  { ssr: false, loading: () => <div className="w-full h-[clamp(20rem,60vh,44rem)] flex items-center justify-center bg-gray-900 rounded-b-lg border-t-0 animate-pulse text-indigo-300">Loading 3D Scene...</div> }
);

const Blueprint2DViewer = dynamic(
  () => import('@/components/Blueprint2DViewer'),
  { ssr: false, loading: () => <div className="w-full h-[clamp(20rem,60vh,44rem)] flex items-center justify-center bg-gray-50 border rounded-lg animate-pulse text-gray-500">Loading 2D Canvas...</div> }
);

export default function BlueprintDataPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const projectId = params.projectId as string;
  const versionId = params.versionId as string;
  
  const [version, setVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadVersion = async () => {
    try {
      const res = await fetch(`/api/companies/${id}/projects/${projectId}/blueprints/v/${versionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersion(data.version);
    } catch (err: any) {
      setError(err.message || 'Error loading blueprint data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id && projectId && versionId) loadVersion();
  }, [user, id, projectId, versionId]);

  if (authLoading || loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="text-red-500 m-10">{error}</div>;

  const data = version?.blueprintData;
  const parsedLines = data ? JSON.parse(data.lines || '[]') : [];
  const parsedPaths = data ? JSON.parse(data.paths || '[]') : [];
  const parsedText = data ? JSON.parse(data.text || '[]') : [];
  const parsedDimensions = data ? JSON.parse(data.dimensions || '[]') : [];
  const parsedNotes = data ? JSON.parse(data.notes || '[]') : [];

  const geometry = version?.geometryData;
  const parsedWalls = geometry ? JSON.parse(geometry.walls || '[]') : [];
  const parsedRooms = geometry ? JSON.parse(geometry.rooms || '[]') : [];
  const parsedOpenings = geometry ? JSON.parse(geometry.openings || '[]') : [];
  
   const handleClassifyRoom = async (roomData: any, newType: string) => {
     try {
       // Fallback for older rooms that didn't have a signature generated in the Python backend
       const featureText = roomData.signature || `Room Area: ${roomData.areaSqFt || roomData.area || 0}, Perimeter: ${roomData.perimeterInches || roomData.perimeter || 0}, Vertices: ${roomData.vertices || (roomData.polygon ? roomData.polygon.length : 0)}`;
       
       const res = await fetch(`/api/companies/${id}/memories`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            memoryType: 'CLASSIFICATION',
            featureText: featureText,
            correctionData: { classification: newType }
         })
       });
       if (res.ok) alert("Room pattern added to Kalki Intelligence Memory. Future identical rooms will automatically be classified as " + newType);
       else {
         const d = await res.json();
         alert(d.error || 'Failed to save correction to Elastic Memory');
       }
     } catch (e: any) {
        alert(e.message);
     }
   };

  return (
    <div className="min-h-screen bg-slate-950 px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-12 md:space-y-16 lg:space-y-20">
        
        {/* Cinematic Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 md:gap-10 border-b border-slate-900 pb-8 md:pb-12 lg:pb-16">
          <div>
            <button 
              onClick={() => router.push(`/dashboard/companies/${id}/projects/${projectId}`)} 
              className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-[0.3em] mb-8 flex items-center gap-3 group transition-all"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Project Fleet
            </button>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-4 md:gap-6 uppercase italic leading-snug">
              <span className="w-2.5 h-10 md:h-12 lg:h-14 bg-indigo-600 rounded-sm"></span>
              Spatial Diagnostic
            </h1>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 md:gap-6 mt-6 md:mt-8">
              <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 rounded-xl border border-slate-800 min-h-11">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Blueprint</span>
                <span className="text-sm text-indigo-300 font-mono font-bold truncate max-w-xs">{version.blueprintSet?.name}</span>
              </div>
              <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 rounded-xl border border-slate-800 min-h-11">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Version</span>
                <span className="text-sm text-emerald-400 font-mono font-bold">v{version.versionNumber}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-6 w-full lg:w-auto">
             <a href={version.fileUrl} target="_blank" rel="noreferrer" className="bg-slate-900 text-slate-300 border border-slate-800 px-6 py-3 min-h-11 rounded-2xl text-sm md:text-base font-bold uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all shadow-2xl text-center">Source PDF</a>
             <ExportReportsMenu 
                version={version} 
                projectName={version.blueprintSet?.project?.name || `Project ${projectId}`} 
                blueprintName={version.blueprintSet?.name || 'Blueprint'} 
             />
          </div>
        </div>

        {/* Spatial Insight Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 lg:gap-8">
           {[{
              label: 'Raw Geometry', count: parsedLines.length, unit: 'Segments', color: 'text-slate-400', border: 'border-slate-800'
           }, {
              label: 'Structural Walls', count: parsedWalls.length, unit: 'BRep Entities', color: 'text-indigo-400', border: 'border-indigo-500/20'
           }, {
              label: 'Volumetric Rooms', count: parsedRooms.length, unit: 'Enclosures', color: 'text-emerald-400', border: 'border-emerald-500/20'
           }, {
              label: 'Spatial Markers', count: parsedDimensions.length, unit: 'Dimensions', color: 'text-amber-400', border: 'border-amber-500/20'
           }, {
              label: 'Technical Spec', count: parsedNotes.length, unit: 'Notes', color: 'text-purple-400', border: 'border-purple-500/20'
           }].map((stat, i) => (
              <div key={i} className={`bg-slate-900/40 backdrop-blur-md p-4 md:p-6 lg:p-8 rounded-[32px] border ${stat.border} shadow-2xl relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-white opacity-[0.02] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">{stat.label}</h3>
                <div className="flex items-baseline gap-3">
                  <p className={`text-4xl font-black font-mono ${stat.color}`}>{stat.count}</p>
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-tighter">{stat.unit}</span>
                </div>
              </div>
           ))}
        </div>

        {/* Unified 3D/2D Control Surface */}
        <div className="space-y-16">
          {version?.blueprint3DModel && (
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-[40px] shadow-2xl border border-slate-800/50 overflow-hidden relative">
               <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-4 uppercase italic tracking-wider">
                      <span className="w-1.5 h-8 bg-indigo-500 rounded-full"></span>
                      3D Volumetric Reconstruction
                    </h2>
                    <p className="text-slate-500 text-sm font-medium max-w-2xl leading-relaxed">
                       Real-time synthesis of BRep geometry from 2D vector data. OBJ, STEP, and USD artifacts are indexed and available for export.
                    </p>
                  </div>
                  <div className="flex gap-4 shrink-0">
                    {version.blueprint3DModel.objUrl && (
                      <a href={version.blueprint3DModel.objUrl} download className="px-6 py-3 min-h-11 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest hover:border-indigo-500 hover:text-white transition-all">OBJ</a>
                    )}
                    {version.blueprint3DModel.stepUrl && (
                      <a href={version.blueprint3DModel.stepUrl} download className="px-6 py-3 min-h-11 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest hover:border-indigo-500 hover:text-white transition-all">STEP</a>
                    )}
                    {version.blueprint3DModel.usdUrl && (
                      <a href={version.blueprint3DModel.usdUrl} download className="px-6 py-3 min-h-11 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest hover:border-indigo-500 hover:text-white transition-all">USDA</a>
                    )}
                  </div>
               </div>
               
               {/* 3D WebGL Viewer (The Command Center) */}
               <div className="p-1">
                 {version.blueprint3DModel.objUrl && (
                   <Blueprint3DViewer 
                       objUrl={version.blueprint3DModel.objUrl} 
                       rooms={parsedRooms} 
                       walls={parsedWalls}
                       takeoff={version.takeoffResult}
                       companyId={id}
                       blueprintId={versionId}
                   />
                 )}
               </div>
            </div>
          )}

          {/* 2D Diagnostic Toolkit */}
          {data && (
             <div className="bg-slate-900/60 backdrop-blur-xl rounded-[40px] shadow-2xl border border-slate-800/50 overflow-hidden">
                <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 border-b border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                   <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-4 uppercase italic tracking-wider">
                      <span className="w-1.5 h-8 bg-emerald-500 rounded-full"></span>
                      2D Vector Extraction
                   </h2>
                   <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-xs text-emerald-500 font-bold uppercase tracking-widest">Live Engine Feed</span>
                   </div>
                </div>
                <div className="p-1">
                  <Blueprint2DViewer 
                    lines={parsedLines} 
                    walls={parsedWalls} 
                    rooms={parsedRooms} 
                    dimensions={parsedDimensions}
                  />
                </div>
             </div>
          )}
        </div>

        {/* Technical Data Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Material Intelligence */}
          {version?.takeoffResult && (
             <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-slate-800/50 shadow-2xl overflow-hidden flex flex-col">
               <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                   <h2 className="text-sm font-bold text-white uppercase tracking-widest">Volumetric Material Takeoff</h2>
                   <span className="text-xs bg-indigo-500/20 text-indigo-400 font-bold px-4 py-1.5 rounded-full uppercase border border-indigo-500/30">Mesh Integrated</span>
               </div>
               
               <div className="p-4 md:p-6 lg:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-16">
                  <div className="space-y-10">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                       Geometric Totals
                    </h3>
                    <div className="space-y-6">
                      {[
                        { label: 'Total Surface', value: version.takeoffResult.wallSurfaceArea, unit: 'SQFT', color: 'text-white' },
                        { label: 'Planar Boundary', value: version.takeoffResult.floorCeilingArea, unit: 'SQFT', color: 'text-slate-300' },
                        { label: 'Internal Volume', value: version.takeoffResult.volume, unit: 'CUFT', color: 'text-slate-300' }
                      ].map((metric, i) => (
                        <div key={i} className="flex justify-between items-center group border-b border-slate-900 pb-4 last:border-0">
                          <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors font-medium">{metric.label}</span>
                          <span className={`font-mono text-base font-bold ${metric.color}`}>{metric.value.toLocaleString()} <span className="text-xs font-normal text-slate-600 ml-1">{metric.unit}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-10">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
                       <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                       Critical Logistics
                    </h3>
                    <div className="space-y-6">
                      {[
                        { label: 'Drywall Panels', value: version.takeoffResult.drywallPanels, detail: '4x8 Standard' },
                        { label: 'Framing Studs', value: version.takeoffResult.studs, detail: '16" OC' },
                        { label: 'Paint (1 Coat)', value: version.takeoffResult.paintGallons, detail: 'Gallons' }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-950/50 p-6 rounded-[24px] border border-slate-800/50 group hover:border-indigo-500/30 transition-all">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-300">{item.label}</span>
                            <span className="text-xs text-slate-600 uppercase font-bold tracking-widest mt-1">{item.detail}</span>
                          </div>
                          <span className="text-2xl font-black text-indigo-400 font-mono tracking-tighter">{item.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
               
               <div className="mt-auto px-4 md:px-6 lg:px-10 py-6 bg-indigo-600/5 border-t border-slate-800/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                    <span className="text-xs text-amber-500 font-bold uppercase tracking-widest">BRep Topographical Computation Active</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {(version.takeoffResult.wasteFactor * 100 - 100).toFixed(0)}% Overage Applied
                  </span>
               </div>
             </div>
          )}

          {/* Specification Sidebar */}
          <div className="flex flex-col gap-12">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-slate-800/50 shadow-2xl overflow-hidden flex-1 flex flex-col">
               <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 border-b border-slate-800 bg-slate-900/50">
                 <h2 className="text-xs font-bold text-white uppercase tracking-widest">Neural Room Classification</h2>
               </div>
               <div className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                 {parsedRooms.length === 0 ? <p className="text-slate-600 text-xs p-10 text-center uppercase font-bold">No spatial enclosures detected.</p> : (
                    <ul className="divide-y divide-slate-900">
                      {parsedRooms.map((room: any, i: number) => (
                        <li key={i} className="p-8 hover:bg-slate-900/50 transition-colors flex justify-between items-center group">
                          <div>
                            <p className="font-bold text-sm text-slate-300 font-mono italic">
                              {room.areaSqFt ?? room.area} <span className="text-xs text-slate-600 not-italic uppercase font-bold ml-2">SQFT</span>
                            </p>
                            <div className="mt-4">
                               {room.classification !== "Unclassified Room" ? (
                                  <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold px-4 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                                     {room.classification}
                                  </span>
                               ) : (
                                  <span className="text-xs text-slate-600 bg-slate-950 px-3 py-1 rounded-lg uppercase font-bold tracking-widest border border-slate-900">Unclassified</span>
                                )}
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                             <select 
                               className="bg-slate-950 text-xs font-bold text-indigo-400 border-slate-800 rounded-xl py-3 min-h-11 pl-4 pr-10 cursor-pointer uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                               onChange={(e) => {
                                 if (e.target.value) {
                                    handleClassifyRoom(room, e.target.value);
                                    e.target.value = "";
                                 }
                               }}
                             >
                                <option value="">Teach Engine</option>
                                <option value="Kitchen">Kitchen</option>
                                <option value="Bathroom">Bathroom</option>
                                <option value="Bedroom">Bedroom</option>
                                <option value="Living Room">Living Area</option>
                                <option value="Stairs">Vertical Path</option>
                             </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                 )}
               </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-slate-800/50 shadow-2xl overflow-hidden">
               <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 border-b border-slate-800 bg-slate-900/50">
                 <h2 className="text-xs font-bold text-white uppercase tracking-widest">Document Intelligence</h2>
               </div>
               <div className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar">
                 {parsedNotes.length === 0 ? <p className="text-slate-600 text-xs p-10 text-center uppercase font-bold">No explicit notations found.</p> : (
                    <ul className="divide-y divide-slate-900">
                      {parsedNotes.map((note: any, i: number) => (
                        <li key={i} className="p-8 hover:bg-slate-900/50 transition-colors">
                          <p className="font-bold text-sm text-slate-300 leading-relaxed uppercase tracking-tighter italic">{note.text}</p>
                          <div className="flex justify-between items-center mt-6">
                             <span className="text-xs text-slate-600 font-bold uppercase tracking-widest">PAGE {note.page}</span>
                             <span className="text-xs bg-slate-950 px-3 py-1 rounded-lg text-indigo-400 font-mono border border-slate-900">EXTRACTED</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                 )}
               </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );

}