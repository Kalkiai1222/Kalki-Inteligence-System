'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useState } from 'react';
import Link from 'next/link';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormDetails = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormDetails>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterFormDetails) => {
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const response = await axios.post('/api/auth/register', data);
      setSuccessMessage(response.data.message);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'An unexpected error occurred');
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
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
           </div>
           <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white uppercase italic flex items-center justify-center gap-4">
              <span className="w-2 h-10 bg-indigo-600 rounded-sm"></span>
              Join the Intelligence
           </h2>
           <p className="mt-4 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-widest">Register for Deterministic Spatial Analysis</p>
        </div>

        {successMessage && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest text-center">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest text-center">{errorMessage}</p>
          </div>
        )}

        <div className="bg-slate-900/40 backdrop-blur-xl p-4 md:p-6 lg:p-8 rounded-[32px] border border-slate-800/50 shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Identity</label>
                <div className="mt-1">
                  <input
                    {...register('name')}
                    id="name"
                    className="w-full rounded-2xl border-slate-800 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-5 py-3 min-h-11 border transition-all outline-none text-sm font-medium italic"
                    placeholder="John Smith"
                  />
                  {errors.name && <p className="mt-1 text-xs font-bold text-red-500 uppercase tracking-tighter ml-2">{errors.name.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Secure Email</label>
                <div className="mt-1">
                  <input
                    {...register('email')}
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-2xl border-slate-800 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-5 py-3 min-h-11 border transition-all outline-none text-sm font-medium italic"
                    placeholder="name@company.com"
                  />
                  {errors.email && <p className="mt-1 text-xs font-bold text-red-500 uppercase tracking-tighter ml-2">{errors.email.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Access Protocol</label>
                <div className="mt-1">
                  <input
                    {...register('password')}
                    id="password"
                    type="password"
                    autoComplete="new-password"
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
              {isSubmitting ? 'Initializing Identity...' : 'Authorize Registration'}
            </button>
            
            <div className="text-center pt-4">
              <Link href="/login" className="text-xs font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">
                Already Authenticated? Secure Sign In &rarr;
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

}
