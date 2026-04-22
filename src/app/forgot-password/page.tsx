'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useState } from 'react';
import Link from 'next/link';

const resetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ResetFormDetails = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetFormDetails>({
    resolver: zodResolver(resetSchema)
  });

  const onSubmit = async (data: ResetFormDetails) => {
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const response = await axios.post('/api/auth/forgot-password', data);
      setSuccessMessage(response.data.message);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'An unexpected error occurred');
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-4 md:p-6 lg:p-8 shadow-lg ring-1 ring-gray-200">
        <div className="text-center">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900 leading-snug">Reset password</h2>
          <p className="mt-2 text-sm md:text-base text-gray-600 leading-relaxed max-w-prose mx-auto">Enter your email and we'll send you a link</p>
        </div>

        {successMessage && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 ring-1 ring-green-600/20">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-600/20">
            {errorMessage}
          </div>
        )}

        {!successMessage && (
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900" htmlFor="email">Email</label>
              <div className="mt-2">
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="block w-full rounded-md border-0 px-3 py-3 min-h-11 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full justify-center rounded-md bg-indigo-600 px-5 py-3 min-h-11 text-sm md:text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
