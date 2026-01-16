import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { authService } from '../../services/auth.service';
import { motion } from 'framer-motion';
import AuroraBorealisBackground from '../../ui/aurora/AuroraBorealisBackground';
import GlassCard from '../../ui/aurora/GlassCard';
import AuroraInput from '../../ui/aurora/AuroraInput';
import AuroraButton from '../../ui/aurora/AuroraButton';
import AuroraSentinelLogo from '../../ui/aurora/AuroraSentinelLogo';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'security'>('student');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "http://localhost:3000/verify-complete",
          data: {
            role: role, // Store role in user metadata
          },
        },
      });

      if (signUpError) {
        // Provide more helpful error messages
        if (signUpError.message.includes('fetch')) {
          setError('Unable to connect to Supabase. Please check your VITE_SUPABASE_URL in frontend/.env file.');
        } else {
          setError(signUpError.message || 'Registration failed');
        }
        return;
      }

      if (data.user) {
        setSuccess(true);
        
        // After successful Supabase signup, create local user in backend
        try {
          await authService.createLocalUser({ email, password, role });
        } catch (localUserError: any) {
          // Don't block signup if local user creation fails
          console.warn('Failed to create local user (non-blocking):', localUserError);
          // User can still verify email and we'll handle it on first login if needed
        }
      }
    } catch (err: any) {
      // Handle network errors and other exceptions
      if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to Supabase. Please check your internet connection and Supabase configuration.');
      } else {
        setError(err.message || 'Registration failed. Please check your Supabase configuration.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-[55%] flex items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-aurora-cyan/5" />

        <GlassCard className="w-full max-w-md p-8 relative z-10">
          <div className="text-center mb-8">
            <AuroraSentinelLogo size="md" showText={true} glowing={false} />
            <p className="text-sm text-muted-foreground mt-2">Create your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/20 border border-destructive/40 text-destructive-foreground px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-safe/20 border border-safe/40 text-foreground px-4 py-3 rounded">
                Verification email sent. Please check your inbox.
              </div>
            )}

            <AuroraInput
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-muted-foreground mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'student' | 'security')}
                className="w-full px-4 py-3 rounded-lg border border-border bg-card/50 text-foreground backdrop-blur-sm focus:outline-none focus:border-primary/50"
              >
                <option value="student">Student</option>
                <option value="security">Security</option>
              </select>
            </div>

            <AuroraInput
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />

            <AuroraInput
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />

            <AuroraButton type="submit" className="w-full mt-2" size="lg" loading={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </AuroraButton>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-aurora-cyan hover:opacity-80 transition-opacity">
                Log In
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>

      <motion.div
        className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <AuroraBorealisBackground interactive={false} />
      </motion.div>
    </div>
  );
}
