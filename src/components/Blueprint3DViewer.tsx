'use client';
import React, { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Html } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';

function Model({ url, viewMode, onSelect, opacity }: { url: string, viewMode: string, onSelect: (obj: any) => void, opacity: number }) {
  const [hoveredMesh, setHoveredMesh] = useState<string | null>(null);
  const obj = useLoader(OBJLoader as any, url) as any;
  
  React.useEffect(() => {
    if (obj) {
      obj.traverse((child: any) => {
        if (child.isMesh) {
          if (!child.userData.defaultColor) {
             const defaultColor = viewMode === 'studs' ? 0x8B5A2B : (viewMode === 'drywall' ? 0xF3F4F6 : 0x3B82F6);
             child.userData.defaultColor = new THREE.Color(defaultColor);
          }
          child.material = new THREE.MeshStandardMaterial({
             color: child.userData.defaultColor,
             wireframe: viewMode === 'studs',
             roughness: viewMode === 'studs' ? 0.8 : (viewMode === 'drywall' ? 0.9 : 0.5),
             metalness: viewMode === 'studs' ? 0.0 : 0.2,
             side: THREE.DoubleSide,
             transparent: opacity < 1.0,
             opacity: opacity
          });
        }
      });
    }
  }, [obj, viewMode, opacity]);

  return (
    <primitive 
      object={obj} 
      onPointerOver={(e: any) => {
        e.stopPropagation();
        if (e.object?.isMesh) {
           e.object.material.color.setHex(0xffaa00);
           setTimeout(() => setHoveredMesh(e.object.uuid), 0);
           document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        if (e.object?.isMesh && e.object.userData.defaultColor) {
           e.object.material.color.copy(e.object.userData.defaultColor);
           setTimeout(() => setHoveredMesh(null), 0);
           document.body.style.cursor = 'auto';
        }
      }}
      onClick={(e: any) => {
         e.stopPropagation();
         if (e.object?.isMesh) {
            onSelect({
               id: e.object.uuid,
               type: 'wall_mesh',
               geometry: e.object.geometry,
               materialIndex: e.object.material.uuid
            });
         }
      }}
    />
  );
}

function RoomVolumes({ rooms, visible, onSelect, selectedObjId, opacity }: { rooms: any[], visible: boolean, onSelect: (r: any) => void, selectedObjId: string | null, opacity: number }) {
   if(!visible || !rooms || rooms.length === 0) return null;
   
   return (
       <group>
         {rooms.map((room, idx) => {
            if(!room.polygon || room.polygon.length < 3) return null;
            const roomId = `room_${room.signature || idx}`;
            return <RoomVolume key={idx} room={room} onSelect={onSelect} isSelected={selectedObjId === roomId} globalOpacity={opacity} />
         })}
       </group>
   )
}

function RoomVolume({ room, onSelect, isSelected, globalOpacity }: { room: any, onSelect: (r: any) => void, isSelected: boolean, globalOpacity: number }) {
    const [hovered, setHovered] = useState(false);
    
    const geometry = useMemo(() => {
       const shape = new THREE.Shape();
       shape.moveTo(room.polygon[0][0], room.polygon[0][1]);
       for(let i = 1; i < room.polygon.length; i++) {
           shape.lineTo(room.polygon[i][0], room.polygon[i][1]);
       }
       return new THREE.ExtrudeGeometry(shape, { depth: 119.5, bevelEnabled: false }); 
    }, [room.polygon]);

    const isClassified = room.classification && room.classification !== 'Unclassified Room';
    const baseColor = isClassified ? 0x10b981 : 0xf59e0b;

    return (
       <mesh 
         geometry={geometry}
         onClick={(e) => {
             e.stopPropagation();
             onSelect({
                 id: `room_${room.signature || Math.random()}`,
                 type: 'room_volume',
                 details: {
                     classification: room.classification,
                     surfaceAreaSqFt: room.areaSqFt,
                     lengthInches: room.perimeterInches,
                     audit: room.audit
                 }
             });
         }}
         onPointerOver={(e) => { e.stopPropagation(); setTimeout(() => setHovered(true), 0); document.body.style.cursor = 'pointer'; }}
         onPointerOut={(e) => { e.stopPropagation(); setTimeout(() => setHovered(false), 0); document.body.style.cursor = 'default'; }}
       >
          <meshStandardMaterial 
             color={isSelected ? 0x3b82f6 : baseColor} 
             transparent={true} 
             opacity={isSelected ? 0.6 : (hovered ? 0.4 : 0.25 * globalOpacity)} 
             depthWrite={false}
             side={THREE.DoubleSide}
          />
          {hovered && (
             <Html position={[room.polygon[0][0], room.polygon[0][1], 120]} center>
                <div className="bg-slate-900/90 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md whitespace-nowrap pointer-events-none transform -translate-y-full mt-[-15px] border border-slate-700/50">
                   <div className="flex items-center gap-3 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isClassified ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                      {isClassified ? room.classification : 'Unknown Space'}
                   </div>
                   <div className="text-slate-400 font-medium border-t border-slate-700/50 pt-2 mt-2 font-mono text-xs">
                      Area: {room.areaSqFt ?? room.area} sqft
                   </div>
                </div>
             </Html>
          )}
        </mesh>
    );
}

function InteractiveWalls({ walls, takeoff, onSelect, selectedObjId, opacity }: { walls: any[], takeoff: any, onSelect: (w: any) => void, selectedObjId: string | null, opacity: number }) {
  if (!walls || walls.length === 0) return null;
  return (
    <group>
      {walls.map((wall, idx) => (
        <InteractiveWall key={idx} wall={wall} onSelect={onSelect} isSelected={selectedObjId === wall.id} globalOpacity={opacity} />
      ))}
    </group>
  );
}

function InteractiveWall({ wall, onSelect, isSelected, globalOpacity }: { wall: any, onSelect: (w: any) => void, isSelected: boolean, globalOpacity: number }) {
  const [hovered, setHovered] = useState(false);
  
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(wall.polygon[0][0], wall.polygon[0][1]);
    for (let i = 1; i < wall.polygon.length; i++) {
      shape.lineTo(wall.polygon[i][0], wall.polygon[i][1]);
    }
    return new THREE.ExtrudeGeometry(shape, { depth: 120, bevelEnabled: false });
  }, [wall.polygon]);

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({
          id: wall.id,
          type: 'wall_entity',
          details: wall.details
        });
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'default'; }}
    >
      <meshStandardMaterial
        color={isSelected ? 0x3b82f6 : (hovered ? 0x6366f1 : 0x475569)}
        transparent={true}
        opacity={isSelected ? 0.8 : (hovered ? 0.6 : 0.4 * globalOpacity)}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function Blueprint3DViewer({ 
  objUrl, 
  rooms = [], 
  walls = [],
  takeoff,
  companyId,
  blueprintId
}: { 
  objUrl: string, 
  rooms?: any[],
  walls?: any[],
  takeoff?: any,
  companyId?: string,
  blueprintId?: string
}) {
  const [viewMode, setViewMode] = useState('standard');
  const [showRooms, setShowRooms] = useState(true);
  const [selectedObj, setSelectedObj] = useState<any>(null);
  const [memoryCorrection, setMemoryCorrection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [showAudit, setShowAudit] = useState(false);

  const handleSubmitCorrection = async () => {
    if (!memoryCorrection.trim() || !companyId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoryType: 'geometry_override',
          featureText: `Correction for object ID: ${selectedObj?.id || 'unknown'} - ${memoryCorrection}`,
          correctionData: {
            blueprintId,
            objectId: selectedObj?.id,
            correction: memoryCorrection,
            geometryType: selectedObj?.type
          }
        })
      });
      if (res.ok) {
        setMemoryCorrection('');
        alert('Correction saved to memory buffer');
        setSelectedObj(null);
      } else {
        alert('Failed to save correction');
      }
    } catch (e) {
      console.error(e);
      alert('Network error saving correction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-[clamp(28rem,75vh,52rem)] bg-slate-950 rounded-[32px] overflow-hidden border border-slate-800 shadow-2xl relative flex flex-col lg:flex-row">
      {/* Sidebar Overlay Controls */}
      <div className="w-full lg:w-[clamp(18rem,24vw,20rem)] bg-slate-900/90 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 md:p-6 lg:p-8 flex flex-col gap-8 z-20 backdrop-blur-xl shadow-2xl lg:relative lg:shrink-0">
        <div className="border-b border-slate-800 pb-6">
           <h3 className="text-white font-black text-lg tracking-wider uppercase text-indigo-400 italic">Kalki Engine v1.0</h3>
           <p className="text-slate-500 text-xs mt-1 font-bold uppercase tracking-widest">Spatial Intelligence Command</p>
        </div>
        
        <div className="flex flex-col gap-4">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Visualization Layer</span>
            <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'standard', label: 'Raw Topology', icon: '⬡' },
                  { id: 'studs', label: 'Framing / Studs', icon: '≣' },
                  { id: 'drywall', label: 'Finished Surface', icon: '■' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => setViewMode(mode.id)} 
                    className={`text-left text-sm px-5 py-3 min-h-11 rounded-xl transition-all duration-300 border flex items-center justify-between group ${viewMode === mode.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-900/40' : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200'}`}
                  >
                    <span className="flex items-center gap-4">
                      <span className={`text-2xl ${viewMode === mode.id ? 'text-white' : 'text-slate-600 group-hover:text-indigo-400'}`}>{mode.icon}</span>
                      <span className="font-bold uppercase tracking-widest text-xs">{mode.label}</span>
                    </span>
                    {viewMode === mode.id && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                  </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col gap-6 border-t border-slate-800 pt-8">
           <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">X-Ray Transparency</span>
                <span className="text-xs font-mono text-indigo-400 font-bold">{Math.round(opacity * 100)}%</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05" 
                value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
           </div>

           <label className="flex items-center justify-between cursor-pointer group py-2">
              <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-widest">Volumetric Rooms</span>
              <div className={`w-11 h-6 rounded-full transition-all duration-300 relative flex items-center ${showRooms ? 'bg-emerald-500/80 shadow-lg shadow-emerald-900/20' : 'bg-slate-800 border border-slate-700'}`}>
                 <div className={`w-4 h-4 bg-white rounded-full absolute shadow-md transition-all duration-300 ${showRooms ? 'translate-x-6' : 'translate-x-1'}`}></div>
              </div>
              <input type="checkbox" checked={showRooms} onChange={e => setShowRooms(e.target.checked)} className="hidden" />
           </label>
        </div>
        
        <div className="mt-auto">
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Engine Status</span>
                </div>
                <div className="space-y-3 font-mono text-xs font-bold">
                    <div className="flex justify-between text-slate-500">
                        <span className="tracking-widest">DETECTION</span>
                        <span className="text-emerald-400 uppercase">Deterministic</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                        <span className="tracking-widest">FORMULA</span>
                        <span className="text-indigo-400">SHOELACE_BRep</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      {/* 3D Canvas Scene */}
      <div className="flex-1 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 cursor-grab active:cursor-grabbing transition-all duration-500 relative min-h-[400px]">
          <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ position: [0, 0, 200], fov: 45 }}>
            <Suspense fallback={null}>
              <Stage environment="city" adjustCamera intensity={0.5}>
                <group>
                  <Model url={objUrl} viewMode={viewMode} onSelect={setSelectedObj} opacity={opacity} />
                  <RoomVolumes rooms={rooms} visible={showRooms} onSelect={setSelectedObj} selectedObjId={selectedObj?.id || null} opacity={opacity} />
                  <InteractiveWalls walls={walls} takeoff={takeoff} onSelect={setSelectedObj} selectedObjId={selectedObj?.id || null} opacity={opacity} />
                </group>
              </Stage>
            </Suspense>
            <OrbitControls 
               makeDefault 
               enableDamping={true}
               dampingFactor={0.05}
               minDistance={10}
               maxDistance={2000}
            />
          </Canvas>
          
          {/* Viewport Overlay Info */}
          <div className="absolute top-10 right-10 pointer-events-none flex flex-col items-end gap-4">
             <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 px-8 py-6 rounded-[24px] shadow-2xl text-right">
                <div className="text-sm text-slate-500 font-bold uppercase tracking-[0.2em] mb-2">Global Surface Area</div>
                <div className="text-2xl font-black text-white font-mono italic tracking-tighter">{takeoff?.wallSurfaceArea || 0}<span className="text-sm text-indigo-400 ml-3 font-bold">SQ FT</span></div>
             </div>
          </div>
      </div>

      {/* Property Editor / Visual Audit Panel */}
      {selectedObj && (
        <div className="w-full lg:w-[clamp(18rem,30vw,26rem)] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 md:p-6 lg:p-10 z-30 shadow-2xl flex flex-col gap-10 overflow-y-auto animate-in slide-in-from-bottom lg:slide-in-from-right-8 duration-500 backdrop-blur-xl absolute lg:relative inset-x-0 bottom-0 lg:inset-auto lg:top-0 lg:bottom-0 lg:right-0 h-[70%] lg:h-auto">
           <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-8">
              <div className="flex flex-col">
                <h3 className="text-white font-black text-lg tracking-wide flex items-center gap-3 uppercase italic">
                   Spatial Inspector
                </h3>
                <span className="text-xs text-indigo-400 font-mono mt-1 font-bold uppercase tracking-widest">{selectedObj.id}</span>
              </div>
              <button 
                 onClick={() => setSelectedObj(null)}
                 className="text-slate-500 hover:text-white h-11 w-11 flex items-center justify-center hover:bg-slate-800 rounded-2xl transition-all"
              >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
              </button>
           </div>
           
           <div className="space-y-10">
              {/* Material Properties */}
              <div className="bg-slate-950/50 p-6 rounded-[32px] border border-slate-800/50">
                 <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Physical Metrics</span>
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-bold uppercase border border-indigo-500/20 tracking-widest">Validated</span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-500 uppercase mb-2 font-bold tracking-widest">Surface Area</div>
                        <div className="text-lg font-bold text-white font-mono">{selectedObj.details?.surfaceAreaSqFt || '0.00'}<span className="text-xs ml-2 text-slate-500">SQFT</span></div>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-500 uppercase mb-2 font-bold tracking-widest">Linear Length</div>
                        <div className="text-lg font-bold text-white font-mono">{selectedObj.details?.lengthInches || '0.0'}<span className="text-xs ml-2 text-slate-500">IN</span></div>
                    </div>
                 </div>

                 {selectedObj.details && (
                   <div className="mt-8 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-500 font-medium uppercase tracking-widest text-xs">Insulation Spec</span>
                         <span className="text-emerald-400 font-bold font-mono tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/10">{selectedObj.details.insulationRValue}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-slate-800/50 pt-4">
                         <span className="text-slate-500 font-medium uppercase tracking-widest text-xs">Drywall Requirement</span>
                         <span className="text-indigo-300 font-bold">{selectedObj.details.drywallPanels} Panels</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-slate-800/50 pt-4">
                         <span className="text-slate-500 font-medium uppercase tracking-widest text-xs">Framing Density</span>
                         <span className="text-indigo-300 font-bold">{selectedObj.details.studs} Studs</span>
                      </div>
                   </div>
                 )}
              </div>

              {/* Visual Audit Section */}
              <div className="flex flex-col gap-4">
                 <button 
                    onClick={() => setShowAudit(!showAudit)}
                    className="flex items-center justify-between w-full px-6 py-4 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl hover:bg-indigo-600/20 transition-all group shadow-xl"
                 >
                    <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest italic">Visual Audit: The Math</span>
                    <span className={`transform transition-transform duration-300 ${showAudit ? 'rotate-180' : ''}`}>▼</span>
                 </button>

                 {showAudit && selectedObj.details?.audit && (
                    <div className="bg-slate-950 p-6 rounded-[32px] border border-indigo-500/20 animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xl">
                       <div className="flex flex-col gap-6">
                          <div>
                             <div className="text-xs text-slate-500 font-bold uppercase mb-4 tracking-widest flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                Shoelace Expansion (Coordinates)
                             </div>
                             <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 font-mono text-xs text-indigo-300/80 leading-relaxed break-all whitespace-pre-wrap shadow-inner overflow-hidden max-h-52 overflow-y-auto custom-scrollbar">
                                {selectedObj.details.audit.formula}
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-800/50">
                             <div>
                                <div className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-widest">Raw Result</div>
                                <div className="text-sm font-bold text-white font-mono">{selectedObj.details.audit.result}</div>
                             </div>
                             <div>
                                <div className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-widest">Unit Precision</div>
                                <div className="text-sm font-bold text-white font-mono">{selectedObj.details.audit.units}</div>
                             </div>
                          </div>
                          
                          <div>
                             <div className="text-xs text-slate-500 font-bold uppercase mb-4 tracking-widest">Vertices Detected</div>
                             <div className="flex flex-wrap gap-2">
                                {selectedObj.details.audit.vertices.slice(0, 8).map((v: any, i: number) => (
                                   <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-lg border border-slate-700 font-mono font-bold tracking-tighter">
                                      [{v[0].toFixed(1)}, {v[1].toFixed(1)}]
                                   </span>
                                ))}
                                {selectedObj.details.audit.vertices.length > 8 && <span className="text-xs text-slate-600 self-center font-bold">+{selectedObj.details.audit.vertices.length - 8} more</span>}
                             </div>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
              
              {/* AI Instruction Override */}
              <div className="flex flex-col gap-4 border-t border-slate-800 pt-10">
                 <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Logic Override</span>
                    <span className="text-xs bg-slate-800 text-slate-500 px-3 py-1 rounded-full uppercase font-bold tracking-widest border border-slate-700">Neural Buffer</span>
                 </div>
                 <textarea 
                    value={memoryCorrection}
                    onChange={e => setMemoryCorrection(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-[24px] p-6 text-base text-slate-300 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:outline-none min-h-[160px] resize-none shadow-2xl transition-all"
                    placeholder="Provide specific structural instructions for this segment..."
                 />
                 <button 
                    onClick={handleSubmitCorrection}
                    disabled={submitting || !memoryCorrection.trim()}
                    className={`py-5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                       submitting || !memoryCorrection.trim() 
                       ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
                       : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xl shadow-indigo-900/40 active:scale-95'
                    }`}
                 >
                    {submitting ? 'Updating Semantic Map...' : 'Commit Change to Memory'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

