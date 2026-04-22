'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AcceptInvitePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/invites/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setInvite(data.invite);
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invite link.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/dashboard/companies/${data.companyId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
       <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
    </div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8 bg-white p-4 md:p-6 lg:p-8 rounded-xl shadow border">
          <div className="text-center">
            <h2 className="mt-6 text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 leading-snug">Invite Broken</h2>
            <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>
          </div>
          <div className="text-center">
             <a href="/dashboard" className="text-indigo-600 hover:text-indigo-500 font-medium">Return to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-4 md:p-6 lg:p-8 rounded-xl shadow border">
        <div className="text-center">
          <h2 className="mt-6 text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 leading-snug">Join Company</h2>
          <p className="mt-2 text-sm md:text-base text-gray-600 leading-relaxed max-w-prose mx-auto">
            You've been invited to join <strong>{invite?.company?.name}</strong>.
          </p>
        </div>

        {user ? (
          user.email.toLowerCase() === invite?.email.toLowerCase() ? (
             <div className="text-center">
               <button
                 onClick={handleAccept}
                 disabled={accepting}
                 className="w-full flex justify-center px-5 py-3 min-h-11 border border-transparent rounded-md shadow-sm text-sm md:text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
               >
                 {accepting ? 'Accepting...' : 'Accept Invitation'}
               </button>
             </div>
          ) : (
            <div className="text-center text-red-600 mb-4 bg-red-50 p-4 rounded text-sm font-medium">
               This invite is for {invite.email}, but you are logged in as {user.email}. Please log out and log back in with the correct email.
            </div>
          )
        ) : (
          <div className="text-center">
            <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed max-w-prose mx-auto">Please log in or create an account to accept.</p>
            <button
              onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)}
              className="w-full flex justify-center px-5 py-3 min-h-11 border border-transparent rounded-md shadow-sm text-sm md:text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign In to Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}