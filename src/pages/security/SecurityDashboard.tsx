import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../state/auth.store';
import { sosService, SOSEvent } from '../../services/sos.service';
import { connectSocket } from '../../ws/client';
import AuroraMap from '../../components/AuroraMap';

export default function SecurityDashboard() {
  const { user, logout } = useAuthStore();
  const [alerts, setAlerts] = useState<SOSEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'security') {
      navigate('/dashboard');
      return;
    }

    loadAlerts();

    // Connect WebSocket
    const token = localStorage.getItem('accessToken');
    if (token) {
      const socket = connectSocket(token);

      const upsertAlert = (event: SOSEvent) => {
        setAlerts((prev) => {
          const idx = prev.findIndex((a) => a.id === event.id);
          if (idx === -1) {
            return [event, ...prev];
          }

          const merged = {
            ...prev[idx],
            ...event,
            email: (event as any).email || (prev[idx] as any).email,
            attachment_urls: (event as any)?.attachment_urls ?? (prev[idx] as any)?.attachment_urls,
          } as any;

          const next = prev.slice();
          next.splice(idx, 1);
          return [merged, ...next];
        });
      };

      // Listen for new SOS alerts
      socket.on('new_sos_alert', (event: SOSEvent) => {
        upsertAlert(event);
        // Play notification sound
        playNotification();
      });

      socket.on('sos:created', (event: SOSEvent) => {
        upsertAlert(event);
      });

      socket.on('sos-updated', (event: SOSEvent) => {
        upsertAlert(event);
      });

      // Listen for status updates
      socket.on('sos_status_update', (event: SOSEvent) => {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === event.id
              ? ({
                  ...alert,
                  ...event,
                  email: (event as any).email || (alert as any).email,
                } as any)
              : alert
          )
        );
      });

      return () => {
        socket.off('new_sos_alert');
        socket.off('sos:created');
        socket.off('sos-updated');
        socket.disconnect();
      };
    }
  }, [user, navigate]);

  const loadAlerts = async () => {
    try {
      const events = await sosService.getSOSEvents({ status: 'new', limit: 50 });
      setAlerts(events);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playNotification = () => {
    const base = (import.meta as any)?.env?.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const candidates = [
      `${prefix}security-alert.mp3`,
      `${prefix}security-alert.wav`,
      `${prefix}security-alert.ogg`,
      `${prefix}no-test.mp3`,
    ];

    const tryPlay = (index: number) => {
      if (index >= candidates.length) {
        const fallback = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURAJR6Tg8sBtJAU0h9Hz04IzBh5uwO/jmVEQCUek4PLAbSQFNIbR89OCMwYebsDv45lREAlHpODywG0kBTSG0fPTgjMGHm7A7+OZURAJR6Tg8sBtJAU0htHz04IzBh5uwO/jmVEQCUek4PLAbSQFNIbR89OCMwYebsDv45lREAlHpODywG0kBTQ='
        );
        fallback.volume = 0.5;
        fallback.play().catch(() => {});
        return;
      }

      const audio = new Audio(candidates[index]);
      audio.volume = 0.6;
      audio.play().catch(() => {
        // Autoplay blocked or failed; try next or fallback
        tryPlay(index + 1);
      });
      audio.onerror = () => tryPlay(index + 1);
    };

    tryPlay(0);
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 50) return 'text-danger';
    if (risk >= 25) return 'text-warning';
    return 'text-safe';
  };

  const getRiskBadge = (risk: number) => {
    if (risk >= 50) return 'HIGH';
    if (risk >= 25) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <div className="min-h-screen aurora-gradient p-6 relative">
      <div className="aurora-bg" />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="glass-panel border-b border-border/50 px-6 py-4 flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold aurora-text">Security Command Center</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.email}</p>
          </div>
          <div className="flex gap-4">
            <Link
              to="/security/analytics"
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Analytics
            </Link>
            <Link
              to="/security/history"
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              History
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Map Section */}
        <div className="mb-6 map-container p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Live Map & SOS Locations</h2>
          <AuroraMap
            sosMarkers={alerts
              .filter((alert) => typeof alert.location?.lat === 'number' && typeof alert.location?.lng === 'number')
              .map((alert) => ({
                id: alert.id,
                lat: alert.location!.lat!,
                lng: alert.location!.lng!,
                riskScore: alert.risk_score,
              }))}
            height="400px"
          />
        </div>

        {/* Alerts Section */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Live Alerts</h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active alerts</div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  to={`/security/alert/${alert.id}`}
                  className="block bg-secondary/40 hover:bg-secondary/60 rounded-lg p-4 transition-colors border border-border/40"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-2xl font-bold ${getRiskColor(alert.risk_score)}`}>
                          {alert.risk_score.toFixed(1)}
                        </span>
                        <span className={`px-3 py-1 rounded text-xs font-semibold ${
                          alert.risk_score >= 50 ? 'bg-danger/20 text-danger' :
                          alert.risk_score >= 25 ? 'bg-warning/20 text-warning' :
                          'bg-safe/20 text-safe'
                        }`}>
                          {getRiskBadge(alert.risk_score)}
                        </span>
                        {Array.isArray((alert as any).attachments) && (alert as any).attachments.length > 0 ? (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-aurora-cyan/15 text-aurora-cyan border border-aurora-cyan/30">
                            MEDIA
                          </span>
                        ) : null}
                        <span className="text-muted-foreground text-sm">
                          {alert.trigger_type.charAt(0).toUpperCase() + alert.trigger_type.slice(1)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        User: {(alert as any).email || alert.user_id || 'Unknown sender'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded text-xs font-semibold ${
                        alert.status === 'resolved' ? 'bg-safe/20 text-safe' :
                        alert.status === 'acknowledged' ? 'bg-warning/20 text-warning' :
                        'bg-danger/20 text-danger'
                      }`}>
                        {alert.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
