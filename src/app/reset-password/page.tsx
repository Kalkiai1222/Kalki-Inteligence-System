'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const newPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

type NewPasswordDetails = z.infer<typeof newPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NewPasswordDetails>({
    resolver: zodResolver(newPasswordSchema)
  });

  if (!token) {
    return (
      <div className="text-center p-4 md:p-6 lg:p-8 bg-red-50 text-red-700 rounded-lg">
        Invalid or missing reset token.
      </div>
    );
  }

  const onSubmit = async (data: NewPasswordDetails) => {
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const response = await axios.post('/api/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
      setSuccessMessage(response.data.message);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'An unexpected error occurred');
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-4 md:p-6 lg:p-8 shadow-lg ring-1 ring-gray-200">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900 leading-snug">Set new password</h2>
        <p className="mt-2 text-sm md:text-base text-gray-600 leading-relaxed max-w-prose mx-auto">Enter your new secure password below.</p>
      </div>

      {successMessage && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 ring-1 ring-green-600/20">
          {successMessage} Redirecting to login...
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
            <label className="block text-sm font-medium leading-6 text-gray-900" htmlFor="newPassword">New Password</label>
            <div className="mt-2">
              <input
                {...register('newPassword')}
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className="block w-full rounded-md border-0 px-3 py-3 min-h-11 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              />
              {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>}
            </div>
          </div>

          <button
             type="submit"
             disabled={isSubmitting}
             className="flex w-full justify-center rounded-md bg-indigo-600 px-5 py-3 min-h-11 text-sm md:text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Suspense fallback={<div>Loading...</div>}>
         <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
