import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import AuroraSentinelLogo from './AuroraSentinelLogo';

interface IntroAnimationProps {
  onComplete: () => void;
}

export default function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const [phase, setPhase] = useState<'intro' | 'exit'>('intro');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('exit');
    }, 900);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background flex items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: 0.6, delay: phase === 'exit' ? 0.1 : 0 }}
    >
      <AuroraSentinelLogo size="xl" showText={true} glowing={true} markScale={5} />
      <motion.p
        className="absolute bottom-10 text-center text-muted-foreground mt-6 text-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        Intelligent Safety. Always Guarding.
      </motion.p>
    </motion.div>
  );
}
