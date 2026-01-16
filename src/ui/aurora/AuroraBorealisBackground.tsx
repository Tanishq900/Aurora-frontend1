import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AuroraBorealisBackgroundProps {
  interactive?: boolean;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
}

function hslVar(name: string, alpha: number) {
  if (typeof window === 'undefined') {
    return `hsla(0, 0%, 100%, ${alpha})`;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `hsl(${raw} / ${alpha})`;
}

export default function AuroraBorealisBackground({ interactive = false }: AuroraBorealisBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  const [stars, setStars] = useState<Star[]>([]);
  useEffect(() => {
    const newStars: Star[] = [];
    for (let i = 0; i < 90; i++) {
      newStars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.8 + 0.4,
        opacity: Math.random() * 0.7 + 0.2,
        twinkleSpeed: Math.random() * 2 + 1,
      });
    }
    setStars(newStars);
  }, []);

  const colors = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        cyan: 'hsla(186, 92%, 46%, 0.5)',
        blue: 'hsla(214, 95%, 56%, 0.4)',
        violet: 'hsla(270, 82%, 60%, 0.35)',
      };
    }
    return {
      cyan: hslVar('--aurora-cyan', 0.55),
      blue: hslVar('--aurora-blue', 0.45),
      violet: hslVar('--aurora-violet', 0.38),
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    },
    [interactive]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawAurora = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      timeRef.current += 0.006;
      const time = timeRef.current;

      const mouseOffsetX = (mousePos.x - 0.5) * 110;
      const mouseOffsetY = (mousePos.y - 0.5) * 60;

      const layers = [
        {
          color1: colors.cyan,
          color2: 'transparent',
          offset: 0,
          amplitude: 85,
          frequency: 0.003,
          speed: 1.0,
          height: 0.52,
        },
        {
          color1: colors.blue,
          color2: 'transparent',
          offset: 18,
          amplitude: 70,
          frequency: 0.0037,
          speed: 0.85,
          height: 0.46,
        },
        {
          color1: colors.violet,
          color2: 'transparent',
          offset: -26,
          amplitude: 60,
          frequency: 0.0048,
          speed: 1.15,
          height: 0.38,
        },
      ];

      layers.forEach((layer) => {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const baseY = height * (1 - layer.height);
          const wave1 = Math.sin((x + mouseOffsetX) * layer.frequency + time * layer.speed) * layer.amplitude;
          const wave2 = Math.sin((x + mouseOffsetX) * layer.frequency * 1.6 + time * layer.speed * 0.7) * (layer.amplitude * 0.45);
          const wave3 = Math.sin((x + mouseOffsetX) * layer.frequency * 0.6 + time * layer.speed * 1.35) * (layer.amplitude * 0.25);
          const y = baseY + wave1 + wave2 + wave3 + layer.offset + mouseOffsetY * 0.35;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.lineTo(width, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.25, layer.color1);
        gradient.addColorStop(0.7, layer.color1);
        gradient.addColorStop(1, layer.color2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(drawAurora);
    };

    drawAurora();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [colors, mousePos.x, mousePos.y]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" onMouseMove={handleMouseMove}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, hsl(270 35% 14% / 0.45) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, hsl(214 45% 12% / 0.35) 0%, transparent 45%), linear-gradient(180deg, hsl(230 30% 8%) 0%, hsl(240 25% 5%) 100%)',
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ mixBlendMode: 'screen' }} />

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {stars.map((star) => (
          <motion.circle
            key={star.id}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.size}
            fill="white"
            initial={{ opacity: star.opacity * 0.5 }}
            animate={{ opacity: [star.opacity * 0.25, star.opacity, star.opacity * 0.25] }}
            transition={{
              duration: star.twinkleSpeed,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: Math.random() * 2,
            }}
          />
        ))}
      </svg>

      {interactive ? (
        <motion.div
          className="pointer-events-none absolute w-96 h-96 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${mousePos.x * 100}%`,
            top: `${mousePos.y * 100}%`,
            background: `radial-gradient(circle, ${hslVar('--aurora-cyan', 0.08)} 0%, transparent 60%)`,
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
    </div>
  );
}
