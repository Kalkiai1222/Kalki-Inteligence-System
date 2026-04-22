import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function HomePage() {
  return (
    <div className="bg-transparent transition-colors duration-500 overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 bg-[var(--color-surface)]/60 backdrop-blur-xl border-b border-[var(--color-border)] transition-colors">
        <nav className="flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" aria-label="Global">
          <div className="flex lg:flex-1 items-center gap-3">
             <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
               <span className="font-black leading-none text-sm tracking-tighter italic">K</span>
             </div>
            <span className="text-lg font-black text-white tracking-[0.2em] uppercase italic flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-sm"></span>
              Kalki Intelligence
            </span>
          </div>
          <div className="flex flex-1 justify-end space-x-6 items-center">
            <ThemeToggle />
            <Link href="/login" className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--color-accent)] transition-colors">
              Log in
            </Link>
            <Link href="/register" className="btn-primary text-sm lg:text-base font-medium flex items-center px-5 py-3 min-h-11">
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative isolate pt-14">
        {/* Apple Developer style ambient background glow */}
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl h-[clamp(20rem,60vh,38rem)] flex justify-center">
          <div className="w-[min(100%,64rem)] h-[clamp(12rem,30vh,20rem)] bg-gradient-to-b from-blue-500/20 via-indigo-500/10 to-transparent rounded-full -mt-16"></div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32 text-center flex flex-col justify-center items-center">
          <div className="animate-slide-up-fade flex flex-col items-center">
            {/* Apple style subtle badge */}
            <div className="mb-8 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-md px-4 py-1.5 text-xs font-bold text-indigo-400 inline-flex items-center gap-2 shadow-sm uppercase tracking-widest transition-transform hover:scale-105 cursor-pointer">
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              Deterministic Spatial Engine
            </div>
            
            <h1 className="max-w-prose text-2xl md:text-3xl lg:text-4xl leading-snug font-black tracking-tight text-white font-jakarta italic uppercase">
              The Architect <br/><span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:opacity-80 transition-opacity cursor-default">of Reality.</span>
            </h1>
            <p className="mt-6 text-sm md:text-base leading-relaxed text-slate-400 max-w-prose font-medium tracking-tight uppercase italic opacity-80">
              Transform 2D blueprints into living 3D intelligence. Kalki reconstructs the physical world with deterministic precision, turning data into spatial truth.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center">
              <Link
                href="/register"
                className="btn-primary text-sm lg:text-base px-6 py-3 min-h-11 w-full sm:w-auto text-center"
              >
                Start for free
              </Link>
              <Link href="/login" className="btn-secondary text-sm lg:text-base flex items-center px-6 py-3 min-h-11 gap-2 w-full sm:w-auto justify-center group">
                Enter Dashboard <span className="group-hover:translate-x-1 transition-transform" aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
