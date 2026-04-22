'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormDetails = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormDetails>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormDetails) => {
    setErrorMessage('');
    try {
      const response = await axios.post('/api/auth/login', data);
      login(response.data.user);
      router.push('/dashboard');
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-0 -ml-20 -mt-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 -mr-20 -mb-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-10 relative z-10">
        <div className="text-center">
           <div className="w-16 h-16 rounded-2xl bg-indigo-600 mx-auto flex items-center justify-center text-white mb-6 shadow-2xl shadow-indigo-900/40 transform hover:rotate-6 transition-transform">
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
           </div>
           <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white uppercase italic flex items-center justify-center gap-4">
              <span className="w-2 h-10 bg-indigo-600 rounded-sm"></span>
              Access Surface
           </h2>
           <p className="mt-4 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-widest">Kalki Intelligence Authorization</p>
        </div>

        {errorMessage && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 animate-shake">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest text-center">{errorMessage}</p>
          </div>
        )}

        <div className="bg-slate-900/40 backdrop-blur-xl p-4 md:p-6 lg:p-8 rounded-[32px] border border-slate-800/50 shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Secure Email</label>
                <div className="mt-1">
                  <input
                    {...register('email')}
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full rounded-2xl border-slate-800 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-5 py-3 min-h-11 border transition-all outline-none text-sm font-medium italic"
                    placeholder="name@company.com"
                  />
                  {errors.email && <p className="mt-1 text-xs font-bold text-red-500 uppercase tracking-tighter ml-2">{errors.email.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Access Protocol</label>
                  <Link href="/forgot-password" className="text-xs font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300">
                    Reset?
                  </Link>
                </div>
                <div className="mt-1">
                  <input
                    {...register('password')}
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-2xl border-slate-800 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-5 py-3 min-h-11 border transition-all outline-none text-sm font-medium italic"
                    placeholder="••••••••"
                  />
                  {errors.password && <p className="mt-1 text-xs font-bold text-red-500 uppercase tracking-tighter ml-2">{errors.password.message}</p>}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full justify-center rounded-2xl bg-indigo-600 px-5 py-3 min-h-11 text-xs md:text-sm font-bold text-white uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-900/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isSubmitting ? 'Authenticating...' : 'Authorize Access'}
            </button>
            
            <div className="text-center pt-4">
              <Link href="/register" className="text-xs font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">
                New Engineer? Join the Intelligence &rarr;
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

}
