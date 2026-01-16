import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../state/auth.store';
import { AnimatePresence, motion } from 'framer-motion';
import IntroAnimation from '../../ui/aurora/IntroAnimation';
import AuroraBorealisBackground from '../../ui/aurora/AuroraBorealisBackground';
import GlassCard from '../../ui/aurora/GlassCard';
import AuroraInput from '../../ui/aurora/AuroraInput';
import AuroraButton from '../../ui/aurora/AuroraButton';
import AuroraSentinelLogo from '../../ui/aurora/AuroraSentinelLogo';

export default function LoginPage() {
  const [showIntro, setShowIntro] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      // Extract backend error message
      const errorMessage = err.message || 'Login failed';
      
      // Show alert with backend error message
      alert(`Login Failed:\n\n${errorMessage}`);
      
      // Set error state to display in UI (persists until user tries again)
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>{showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}</AnimatePresence>

      <div className="min-h-screen flex">
        <motion.div
          className="w-full lg:w-[55%] flex items-center justify-center p-8 relative"
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: showIntro ? 0 : 1, x: showIntro ? -100 : 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-aurora-cyan/5" />

          <GlassCard className="w-full max-w-md p-8 relative z-10">
            <div className="text-center mb-8">
              <AuroraSentinelLogo size="lg" showText={true} glowing={true} markScale={5} />
              <p className="text-sm text-muted-foreground mt-1">Campus Security System</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/20 border border-destructive/40 text-destructive-foreground px-4 py-3 rounded">
                  <div className="font-semibold mb-1">Login Error:</div>
                  <div className="text-sm">{error}</div>
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

              <AuroraInput
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <AuroraButton type="submit" className="w-full mt-2" size="lg" loading={isLoading}>
                {isLoading ? 'Logging in...' : 'Sign In'}
              </AuroraButton>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-aurora-cyan hover:opacity-80 transition-opacity">
                  Register
                </Link>
              </p>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: showIntro ? 0 : 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <AuroraBorealisBackground interactive={false} />

          <motion.div
            className="relative z-10 text-center px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showIntro ? 0 : 1, y: showIntro ? 20 : 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <AuroraSentinelLogo size="lg" showText={true} glowing={false} markScale={5} />

            <motion.p
              className="text-muted-foreground mt-6 max-w-sm mx-auto text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              Intelligent Safety. Always Guarding.
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
