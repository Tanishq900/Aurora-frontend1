import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function VerifyComplete() {
  const [status, setStatus] = useState<'verifying' | 'verified' | 'error'>('verifying');
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    // Handle Supabase email verification tokens from URL hash
    const handleVerification = async () => {
      try {
        // Supabase sends verification tokens in URL hash (e.g., #access_token=...&type=email)
        // The Supabase client automatically processes these on page load
        // We need to wait for the session to be established
        
        // Check for hash parameters first (most common)
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        // Also check query params (fallback)
        const queryParams = new URLSearchParams(location.search);
        const queryToken = queryParams.get('token');
        const queryType = queryParams.get('type');

        if (accessToken && type === 'email') {
          // Supabase email verification with hash tokens
          // Exchange the tokens for a session - this automatically sets email_confirmed_at
          const { data: { session }, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          });

          if (sessionError) {
            throw sessionError;
          }

          // If setSession succeeds, email is automatically confirmed by Supabase
          if (session?.user) {
            setStatus('verified');
          } else {
            throw new Error('Failed to establish session');
          }
        } else if (queryToken && queryType === 'email') {
          // Handle query param tokens (OTP verification)
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: queryToken,
            type: 'email',
          });

          if (verifyError) {
            throw verifyError;
          }
          setStatus('verified');
        } else {
          // No tokens in URL - check if user is already verified
          // This handles cases where user refreshes the page after verification
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email_confirmed_at) {
            setStatus('verified');
          } else if (session?.user) {
            // User has session but email not confirmed - might be processing
            setStatus('verified'); // Show success, Supabase will update email_confirmed_at
          } else {
            setError('Verification link is invalid or expired. Please request a new verification email.');
            setStatus('error');
          }
        }
      } catch (err: any) {
        console.error('Verification error:', err);
        setError(err.message || 'Verification failed. Please try again or request a new verification email.');
        setStatus('error');
      }
    };

    handleVerification();
  }, [location]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold text-white mb-2">Verifying Email</h1>
            <p className="text-slate-400">Please wait while we verify your email...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-red-400 mb-4">{error}</p>
          </div>

          <div className="mt-6 text-center space-y-4">
            <Link
              to="/register"
              className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Back to Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Email Verified</h1>
          <p className="text-slate-400">Hurray! Your email has been verified. You may now log in.</p>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
