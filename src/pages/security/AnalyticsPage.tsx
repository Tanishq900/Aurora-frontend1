import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../state/auth.store';
import { analyticsService, WeeklyAlertsData } from '../../services/analytics.service';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

function AnalyticsCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-2xl bg-background/55 backdrop-blur border border-border/40 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-foreground leading-tight">{title}</h2>
            {subtitle ? <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-3 pb-4">{children}</div>
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-background/95 backdrop-blur px-3 py-2 shadow-lg">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="mt-1 space-y-1">
        {payload
          .filter((p: any) => p && p.value !== undefined)
          .map((p: any) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="text-muted-foreground truncate">{p.name || p.dataKey}</span>
              </div>
              <span className="text-foreground tabular-nums">{Number(p.value).toLocaleString()}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<WeeklyAlertsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const analytics = await analyticsService.getWeeklyAlerts();
      setData(analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen aurora-gradient p-6 relative">
        <div className="aurora-bg" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="glass-panel p-6 text-center text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen aurora-gradient p-6 relative">
        <div className="aurora-bg" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="glass-panel p-6 text-center text-muted-foreground">Failed to load analytics</div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.labels.map((label, index) => ({
    day: label,
    sos: data.sos[index],
    ai: data.ai[index],
  }));

  const colors = {
    sos: 'hsl(var(--destructive))',
    ai: 'hsl(var(--aurora-cyan))',
    grid: 'hsl(var(--border))',
    tick: 'hsl(var(--muted-foreground))',
  } as const;

  return (
    <div className="min-h-screen aurora-gradient p-6 relative">
      <div className="aurora-bg" />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="glass-panel border-b border-border/50 px-6 py-4 flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold aurora-text">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">Weekly alert statistics{user?.email ? ` • ${user.email}` : ''}</p>
          </div>
          <div className="flex gap-4">
            <Link
              to="/security"
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Logout
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="rounded-2xl bg-background/55 backdrop-blur border border-border/40 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <h3 className="text-muted-foreground text-xs sm:text-sm">Total SOS This Week</h3>
            <p className="mt-2 text-3xl sm:text-4xl font-semibold text-foreground tabular-nums">{data.kpis.totalSOS}</p>
          </div>
          <div className="rounded-2xl bg-background/55 backdrop-blur border border-border/40 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <h3 className="text-muted-foreground text-xs sm:text-sm">Peak Day</h3>
            <p className="mt-2 text-3xl sm:text-4xl font-semibold text-foreground truncate">{data.kpis.peakDay}</p>
          </div>
          <div className="rounded-2xl bg-background/55 backdrop-blur border border-border/40 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <h3 className="text-muted-foreground text-xs sm:text-sm">Highest AI Risk Count</h3>
            <p className="mt-2 text-3xl sm:text-4xl font-semibold text-foreground tabular-nums">{data.kpis.highestAIRisk}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <AnalyticsCard title="SOS Alerts" subtitle="Count per day">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 6, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} opacity={0.25} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: colors.tick, fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: colors.tick, fontSize: 12 }}
                  width={34}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(135, 235, 173, 0.08)' }} wrapperStyle={{ outline: 'none' }} />
                <Bar dataKey="sos" name="SOS" fill={colors.sos} radius={4} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsCard>

          <AnalyticsCard title="AI Risk Spikes" subtitle="Detected spikes per day">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 6, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} opacity={0.25} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: colors.tick, fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: colors.tick, fontSize: 12 }}
                  width={34}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(37, 246, 228, 0.25)', strokeWidth: 1 }} wrapperStyle={{ outline: 'none' }} />
                <Line
                  type="monotone"
                  dataKey="ai"
                  name="AI"
                  stroke={colors.ai}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, fill: colors.ai, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </AnalyticsCard>
        </div>

        {/* Combined Chart */}
        <AnalyticsCard title="SOS vs AI" subtitle="Comparison view">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 22, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} opacity={0.25} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: colors.tick, fontSize: 12 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: colors.tick, fontSize: 12 }} width={34} />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.tick, fontSize: 12 }}
                width={34}
              />
              <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="square"
                wrapperStyle={{ paddingBottom: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Bar yAxisId="left" dataKey="sos" name="SOS" fill={colors.sos} radius={4} barSize={20} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ai"
                name="AI"
                stroke={colors.ai}
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, fill: colors.ai, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      </div>
    </div>
  );
}
