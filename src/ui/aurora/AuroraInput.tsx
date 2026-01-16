import { forwardRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuroraInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AuroraInput = forwardRef<HTMLInputElement, AuroraInputProps>(({ label, error, type, className, ...props }, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';

  return (
    <div className="relative space-y-2">
      {label && <label className="block text-sm font-medium text-muted-foreground">{label}</label>}

      <div className="relative">
        <AnimatePresence>
          {isFocused && (
            <motion.div
              className="absolute -inset-[2px] rounded-lg opacity-50"
              style={{
                background: error
                  ? 'linear-gradient(135deg, hsl(var(--danger) / 0.3), hsl(var(--danger) / 0.1))'
                  : 'linear-gradient(135deg, hsl(172 66% 50% / 0.3), hsl(160 84% 39% / 0.1))',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>

        <input
          ref={ref}
          type={isPassword && showPassword ? 'text' : type}
          className={cn(
            'relative w-full rounded-lg border border-border bg-card/50 px-4 py-3 text-foreground',
            'placeholder:text-muted-foreground/50 backdrop-blur-sm',
            'transition-all duration-300',
            'focus:outline-none focus:border-primary/50',
            isPassword && 'pr-12',
            error && 'border-destructive/50',
            className
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1.5 text-destructive text-sm"
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AuroraInput.displayName = 'AuroraInput';

export default AuroraInput;
