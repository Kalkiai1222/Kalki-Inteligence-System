'use client';

import { useEffect, useState, Suspense } from 'react';
import axios from 'axios';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailLogic() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    const verify = async () => {
      try {
        const res = await axios.get(`/api/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(res.data.message);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Verification failed.');
      }
    };
    verify();
  }, [token]);

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-4 md:p-6 lg:p-8 shadow-lg ring-1 ring-gray-200 text-center">
      <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900 leading-snug">Email Verification</h2>

      {status === 'loading' && <p className="text-sm md:text-base text-gray-600 leading-relaxed">Verifying your email, please wait...</p>}
      
      {status === 'success' && (
        <div className="space-y-4">
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 ring-1 ring-green-600/20">
            {message}
          </div>
          <Link href="/login" className="block text-sm md:text-base text-indigo-600 hover:underline">Go to sign in</Link>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
           <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-600/20">
              {message}
           </div>
           <Link href="/login" className="block text-sm md:text-base text-indigo-600 hover:underline">Go to sign in</Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailLogic />
      </Suspense>
    </div>
  );
}
