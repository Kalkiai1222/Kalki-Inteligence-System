'use client';

import { useAuth } from '@/hooks/useAuth';
import { Briefcase, Plus, FileText, Anchor } from 'lucide-react';

export default function JobsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="w-full flex-1 flex flex-col pt-4 md:pt-6 lg:pt-8 animate-slide-up-fade overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-2 leading-snug">Jobs Overview</h1>
          <p className="text-[var(--text-muted)] text-sm md:text-base leading-relaxed max-w-prose">
            Manage and trace all structural estimation jobs.
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm lg:text-base px-6 py-3 min-h-11 w-full md:w-fit">
          <Plus size={16} />
          Create New Job
        </button>
      </div>

      <div className="card-premium flex-1 min-h-[400px] flex flex-col items-center justify-center text-center p-4 md:p-6 lg:p-8">
        <div className="w-16 h-16 rounded-full bg-[var(--color-surface)] flex items-center justify-center mb-4 border border-[var(--color-border)] shadow-sm">
          <Briefcase size={28} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight mb-2">No active jobs yet</h3>
        <p className="text-[var(--text-muted)] max-w-prose text-sm md:text-base leading-relaxed mb-6">
          Upload a blueprint or create a new job manually to initiate the AI takeoff process.
        </p>
        <button className="btn-secondary text-sm lg:text-base px-6 py-3 min-h-11">Upload Blueprint</button>
      </div>
    </div>
  );
}
