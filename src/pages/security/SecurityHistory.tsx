import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/auth.store';
import { sosService, SOSEvent } from '../../services/sos.service';
import AuroraSelect from '../../ui/aurora/AuroraSelect';

export default function SecurityHistory() {
  const { user, logout } = useAuthStore();
  const [events, setEvents] = useState<SOSEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    limit: 100,
  });
  const navigate = useNavigate();

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await sosService.getSOSEvents({
        status: filters.status || undefined,
        limit: filters.limit,
      });
      setEvents(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters.limit, filters.status]);

  useEffect(() => {
    if (user?.role !== 'security') {
      navigate('/dashboard');
      return;
    }

    loadHistory();
  }, [loadHistory, navigate, user?.role]);

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all SOS history? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await sosService.clearHistory();
      alert(`History cleared successfully. Deleted ${result.deleted} events.`);
      setEvents([]); // Clear the events from UI
    } catch (error: any) {
      alert(`Failed to clear history: ${error.response?.data?.error || error.message}`);
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 50) return 'text-danger';
    if (risk >= 25) return 'text-warning';
    return 'text-safe';
  };

  return (
    <div className="min-h-screen bg-black p-6 relative">
      <div className="aurora-bg" />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="glass-panel border-b border-border/50 px-6 py-4 flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold aurora-text">Alert History</h1>
            <p className="text-sm text-muted-foreground">All SOS events</p>
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

        {/* Filters */}
        <div className="glass-panel p-4 mb-6">
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4">
              <AuroraSelect
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'new', label: 'New' },
                  { value: 'acknowledged', label: 'Acknowledged' },
                  { value: 'resolved', label: 'Resolved' },
                ]}
              />
            </div>
            <button
              onClick={handleClearHistory}
              className="px-4 py-2 bg-danger hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
            >
              Clear History
            </button>
          </div>
        </div>

        {/* Events Table */}
        <div className="glass-panel p-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No events found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="pb-3 text-muted-foreground">Date</th>
                    <th className="pb-3 text-muted-foreground">Risk Score</th>
                    <th className="pb-3 text-muted-foreground">Trigger</th>
                    <th className="pb-3 text-muted-foreground">Status</th>
                    <th className="pb-3 text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="py-3 text-muted-foreground">{new Date(event.created_at).toLocaleString()}</td>
                      <td className={`py-3 font-bold ${getRiskColor(event.risk_score)}`}>
                        {event.risk_score.toFixed(1)}
                      </td>
                      <td className="py-3 text-muted-foreground">{event.trigger_type.charAt(0).toUpperCase() + event.trigger_type.slice(1)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          event.status === 'resolved' ? 'bg-safe/20 text-safe' :
                          event.status === 'acknowledged' ? 'bg-warning/20 text-warning' :
                          'bg-danger/20 text-danger'
                        }`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/security/alert/${event.id}`}
                          className="text-aurora-cyan hover:opacity-80 transition-opacity"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
