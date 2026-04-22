'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Blueprint2DViewerProps {
  lines: any[];
  walls: any[];
  rooms: any[];
  dimensions: any[];
}

export default function Blueprint2DViewer({ lines, walls, rooms, dimensions }: Blueprint2DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport transforms
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Layer visibility toggles
  const [visibleLayers, setVisibleLayers] = useState({
    rawLines: false, // Default off to reduce visual clutter initially
    walls: true,
    rooms: true,
    dimensions: true
  });

  // Calculate generic bounding box spanning walls, lines and dimensions to fit scaling
  useEffect(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const updateBounds = (x: number, y: number) => {
      if (typeof x !== 'number' || typeof y !== 'number') return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    walls.forEach((wallItem: any) => {
      try {
        const ring = wallItem.polygon || wallItem;
        ring?.forEach?.((pt: any[]) => updateBounds(pt[0], pt[1]));
      } catch (e) { } // Dirty band-aid to suppress the crash
    });

    lines.forEach(l => {
      if (l.p1) updateBounds(l.p1[0], l.p1[1]);
      if (l.p2) updateBounds(l.p2[0], l.p2[1]);
    });

    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 1000; maxY = 1000;
    }

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Viewport auto-fit
    if (containerRef.current) {
      const boxWidth = maxX - minX;
      const boxHeight = maxY - minY;
      const ctWidth = containerRef.current.clientWidth;
      const ctHeight = containerRef.current.clientHeight;

      const scale = Math.min(ctWidth / boxWidth, ctHeight / boxHeight);

      // Center content
      const cx = minX + boxWidth / 2;
      const cy = minY + boxHeight / 2;

      const startX = (ctWidth / 2) - (cx * scale);
      const startY = (ctHeight / 2) - (cy * scale);

      setTransform({ x: startX, y: startY, scale: scale });
    }
  }, [walls, lines]);

  // Pan / Drag handles
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Zoom handling logic centered on mouse cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!containerRef.current) return;

    // Determine zoom direction
    const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;

    // Position of the mouse cursor relative to container
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform(prev => {
      const newScale = prev.scale * scaleChange;

      // We want the point under the mouse to stay stationary
      // ptX = (mouseX - prev.x) / prev.scale;
      // newX = mouseX - ptX * newScale;
      const newX = mouseX - (mouseX - prev.x) * scaleChange;
      const newY = mouseY - (mouseY - prev.y) * scaleChange;

      return { x: newX, y: newY, scale: Math.max(0.01, Math.min(newScale, 50)) };
    });
  }, []);


  return (
    <div className="relative w-full h-[clamp(20rem,60vh,44rem)] border border-slate-800 rounded-[32px] overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing group shadow-2xl">

      {/* Drawing Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg className="w-full h-full pointer-events-none stroke-linejoin-round stroke-linecap-round">
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>

            {/* Layer 1: Raw Vector Lines */}
            {visibleLayers.rawLines && lines.map((l, i) => {
              if (!l.p1 || !l.p2) return null;
              return <line key={`line-${i}`} x1={l.p1[0]} y1={l.p1[1]} x2={l.p2[0]} y2={l.p2[1]} stroke="#334155" strokeWidth={1 / transform.scale} />;
            })}

            {/* Layer 2: Rooms */}
            {visibleLayers.rooms && rooms.map((r, i) => {
              if (!r.polygon) return null;
              const pts = r.polygon.map((p: any[]) => `${p[0]},${p[1]}`).join(' ');
              // Dynamic color mapping based on classification
              const knownType = r.classification && r.classification !== 'Unclassified Room';
              const fill = knownType ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.1)'; // emerald or amber
              const stroke = knownType ? '#10b981' : '#f59e0b';

              return (
                <g key={`room-${i}`}>
                  <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2 / transform.scale} />
                  {/* Label centered via polygon estimation */}
                  {r.polygon.length > 0 && r.classification && (
                    <text
                      x={r.polygon[0][0]}
                      y={r.polygon[0][1]}
                      fontSize={12 / transform.scale}
                      fill={stroke}
                      className="font-black pointer-events-none drop-shadow-2xl uppercase italic tracking-tighter"
                    >
                      {r.classification}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Layer 3: Reconstructed Walls */}
            {visibleLayers.walls && walls.map((wallItem: any, i) => {
              const ring = wallItem.polygon || wallItem;
              if (!Array.isArray(ring)) return null;

              const pts = ring.map((p: any[]) => `${p[0]},${p[1]}`).join(' ');
              return <polygon key={`wall-${i}`} points={pts} fill="rgba(79, 70, 229, 0.2)" stroke="#6366f1" strokeWidth={3 / transform.scale} />;
            })}

            {/* Layer 4: Structural Dimensions */}
            {visibleLayers.dimensions && dimensions.map((d, i) => {
              if (!d.bbox) return null;
              const [x0, y0, x1, y1] = d.bbox;
              const textX = x0 + (x1 - x0) / 2;
              const textY = y0 + (y1 - y0) / 2;

              return (
                <g key={`dim-${i}`}>
                  <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke="#fbbf24" strokeWidth={1 / transform.scale} strokeDasharray={`${4 / transform.scale},${2 / transform.scale}`} opacity={0.4} />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={(d.size || 14) / transform.scale}
                    fill="#f59e0b"
                    className="font-mono drop-shadow-2xl font-black pointer-events-none italic"
                  >
                    {d.text}
                  </text>
                </g>
              );
            })}

          </g>
        </svg>
      </div>

      {/* Controller HUD Overlay */}
      <div className="absolute top-4 right-4 lg:top-8 lg:right-8 bg-slate-900/90 backdrop-blur-xl shadow-2xl border border-slate-800/50 rounded-2xl p-4 lg:p-6 w-[clamp(12rem,70vw,16rem)] max-w-[calc(100vw-2rem)] flex flex-col gap-4 lg:gap-5 group-hover:opacity-100 transition-opacity z-10">
        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-1 border-b border-slate-800 pb-3 italic">Viewport Layers</h3>

        <label className="flex items-center gap-4 cursor-pointer group/item">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={visibleLayers.walls}
              onChange={e => setVisibleLayers(p => ({ ...p, walls: e.target.checked }))}
              className="peer opacity-0 absolute w-5 h-5 cursor-pointer"
            />
            <div className="w-5 h-5 border-2 border-slate-700 rounded-lg peer-checked:bg-indigo-600 peer-checked:border-indigo-400 transition-all"></div>
            <svg className="absolute w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-sm font-bold text-slate-300 flex items-center gap-3 uppercase tracking-widest leading-snug">
            <span className="w-3.5 h-3.5 bg-indigo-600 rounded-sm inline-block shadow-lg shadow-indigo-900/40"></span>
            Solid Walls
          </span>
        </label>

        <label className="flex items-center gap-4 cursor-pointer group/item">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={visibleLayers.rooms}
              onChange={e => setVisibleLayers(p => ({ ...p, rooms: e.target.checked }))}
              className="peer opacity-0 absolute w-5 h-5 cursor-pointer"
            />
            <div className="w-5 h-5 border-2 border-slate-700 rounded-lg peer-checked:bg-emerald-600 peer-checked:border-emerald-400 transition-all"></div>
            <svg className="absolute w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-sm font-bold text-slate-300 flex items-center gap-3 uppercase tracking-widest leading-snug">
            <span className="w-3.5 h-3.5 bg-emerald-500 rounded-sm inline-block shadow-lg shadow-emerald-900/40"></span>
            Rooms
          </span>
        </label>

        <label className="flex items-center gap-4 cursor-pointer group/item">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={visibleLayers.rawLines}
              onChange={e => setVisibleLayers(p => ({ ...p, rawLines: e.target.checked }))}
              className="peer opacity-0 absolute w-5 h-5 cursor-pointer"
            />
            <div className="w-5 h-5 border-2 border-slate-700 rounded-lg peer-checked:bg-slate-600 peer-checked:border-slate-400 transition-all"></div>
            <svg className="absolute w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-sm font-bold text-slate-300 flex items-center gap-3 uppercase tracking-widest leading-snug">
            <span className="w-3.5 h-0.5 bg-slate-500 inline-block"></span>
            Vectors
          </span>
        </label>

        <label className="flex items-center gap-4 cursor-pointer group/item">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={visibleLayers.dimensions}
              onChange={e => setVisibleLayers(p => ({ ...p, dimensions: e.target.checked }))}
              className="peer opacity-0 absolute w-5 h-5 cursor-pointer"
            />
            <div className="w-5 h-5 border-2 border-slate-700 rounded-lg peer-checked:bg-amber-600 peer-checked:border-amber-400 transition-all"></div>
            <svg className="absolute w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-sm font-bold text-slate-300 flex items-center gap-3 uppercase tracking-widest leading-snug">
            <span className="text-amber-500 text-xs font-black mono px-1.5 py-0.5 border border-amber-500/40 border-dashed rounded bg-amber-500/5 italic">12'</span>
            Dimensions
          </span>
        </label>

        <div className="text-xs text-slate-500 mt-2 border-t border-slate-800 pt-4 text-center pointer-events-none uppercase font-bold tracking-widest">
          Scroll to Zoom • Drag to Pan
        </div>
      </div>

    </div>
  );


}