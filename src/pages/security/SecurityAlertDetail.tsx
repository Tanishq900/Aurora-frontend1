import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sosService, SOSEvent, SOSChatMessage } from '../../services/sos.service';
import { connectSocket, getSocket } from '../../ws/client';
import { useAuthStore } from '../../state/auth.store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AuroraMap from '../../components/AuroraMap';
import EventTimeline from '../../components/EventTimeline';

export default function SecurityAlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [alert, setAlert] = useState<SOSEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentsLoading] = useState(false);
  const attachmentPaths = Array.isArray((alert as any)?.attachments) ? ((alert as any).attachments as string[]) : [];
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatForbidden, setChatForbidden] = useState(false);
  const [chatReadOnly, setChatReadOnly] = useState(false);
  const [chatSecurityEmail, setChatSecurityEmail] = useState<string | undefined>(undefined);
  const [chatMessages, setChatMessages] = useState<SOSChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const alertUserIdRef = useRef<string | null>(null);

  const loadChat = async () => {
    if (!id) return;
    if (!user) return;

    setChatLoading(true);
    setChatError(null);

    try {
      const bundle: any = await sosService.getSOSChatById(id);
      setChatForbidden(false);
      setChatMessages(Array.isArray(bundle?.messages) ? (bundle.messages as SOSChatMessage[]) : []);
      setChatReadOnly(Boolean(bundle?.read_only));
      setChatSecurityEmail(bundle?.chat?.security_email);

      const socket = getSocket();
      if (socket) {
        if (socket.connected) {
          socket.emit('join_sos_chat', id);
        } else {
          const onConnect = () => {
            socket.emit('join_sos_chat', id);
            socket.off('connect', onConnect);
          };
          socket.on('connect', onConnect);
        }
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) {
        setChatForbidden(true);
        return;
      }
      const msg = e?.response?.data?.error || e?.message || 'Failed to load chat';
      setChatError(msg);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    alertUserIdRef.current = alert?.user_id || null;
  }, [alert?.user_id]);

  useEffect(() => {
    if (!id) return;

    loadAlert();

    // Connect WebSocket and join SOS room
    const token = localStorage.getItem('accessToken');
    if (token) {
      const socket = connectSocket(token);
      socket.emit('join_sos', id);

      socket.on('live_feed', (data: any) => {
        setLiveFeed((prev) => {
          const expectedUserId = alertUserIdRef.current;
          if (expectedUserId && data?.userId && data.userId !== expectedUserId) {
            return prev;
          }
          return [...prev.slice(-50), data];
        });
      });

      socket.on('sos_status_update', (event: SOSEvent) => {
        if (event.id === id) {
          setAlert((prev) => {
            if (!prev) return event;
            return {
              ...prev,
              ...event,
              attachment_urls: (event as any)?.attachment_urls ?? (prev as any)?.attachment_urls,
            } as any;
          });
        }
      });

      socket.on('sos-updated', (event: SOSEvent) => {
        if (event.id === id) {
          setAlert((prev) => {
            if (!prev) return event;
            return {
              ...prev,
              ...event,
              attachment_urls: (event as any)?.attachment_urls ?? (prev as any)?.attachment_urls,
            } as any;
          });
        }
      });

      return () => {
        socket.off('live_feed');
        socket.off('sos_status_update');
        socket.off('sos-updated');
        socket.emit('leave_sos', id);
      };
    }
  }, [id]);

  useEffect(() => {
    const urls = (alert as any)?.attachment_urls as string[] | undefined;
    if (!alert || !Array.isArray(urls)) {
      setAttachmentUrls([]);
      return;
    }
    setAttachmentUrls(urls);
  }, [alert?.id, (alert as any)?.attachment_urls]);

  useEffect(() => {
    if (!id) return;
    if (!user) return;

    setChatForbidden(false);
    setChatMessages([]);
    setChatSecurityEmail(undefined);

    loadChat();
    return () => {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('leave_sos_chat', id);
      }
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) return;
    if (!user) return;
    if (user.role !== 'security') return;
    if (alert?.status !== 'acknowledged') return;
    if (!chatForbidden && chatSecurityEmail) return;
    loadChat();
  }, [alert?.status, chatForbidden, chatSecurityEmail, id, user?.id, user?.role]);

  useEffect(() => {
    if (alert?.status === 'resolved') {
      setChatReadOnly(true);
    }
  }, [alert?.status]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    if (!socket) return;

    const handleChatMessage = (msg: any) => {
      if (!msg || String(msg.sos_id) !== String(id)) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg as SOSChatMessage];
      });
    };

    const handleChatError = (payload: any) => {
      if (!payload || String(payload.sosId) !== String(id)) return;
      setChatError(payload.error || 'Failed to send message');
    };

    socket.on('chat:message', handleChatMessage);
    socket.on('chat:error', handleChatError);

    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:error', handleChatError);
    };
  }, [id]);

  const sendChatMessage = async () => {
    if (!id) return;
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    if (chatReadOnly || alert?.status === 'resolved') return;
    setChatError(null);

    try {
      const sent = await sosService.sendSOSChatMessage(id, trimmed);
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setChatDraft('');

      await loadChat();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to send message';
      setChatError(msg);
    }
  };

  const loadAlert = async () => {
    if (!id) return;

    try {
      const event = await sosService.getSOSById(id);
      setAlert(event);
    } catch (error) {
      console.error('Failed to load alert:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (status: 'acknowledged' | 'resolved') => {
    if (!id) return;

    if (user?.role !== 'security') {
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = 'Only security personnel can update status';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3000);
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const updated = await sosService.updateStatus(id, status);
      setAlert((prev) => {
        if (!prev) return updated;
        return {
          ...prev,
          ...updated,
          attachment_urls: (updated as any)?.attachment_urls ?? (prev as any)?.attachment_urls,
        } as any;
      });

      if (status === 'acknowledged') {
        await loadChat();
      }
      
      // Show toast notification
      const message = status === 'acknowledged' 
        ? 'Alert acknowledged successfully' 
        : 'Alert marked as resolved';
      
      // Simple toast implementation
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    } catch (error) {
      console.error('Failed to update status:', error);
      
      // Show error toast
      const backendError = (error as any)?.response?.data?.error || (error as any)?.response?.data?.message || (error as any)?.message || 'Failed to update status';
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = backendError;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen aurora-gradient flex items-center justify-center relative">
        <div className="aurora-bg" />
        <div className="glass-panel p-6 text-muted-foreground relative z-10">Loading...</div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen aurora-gradient flex items-center justify-center relative">
        <div className="aurora-bg" />
        <div className="glass-panel p-6 text-muted-foreground relative z-10">Alert not found</div>
      </div>
    );
  }

  const chartData = liveFeed.map((feed, index) => ({
    time: index,
    risk: feed.totalRisk,
    audio: feed.audio?.stress * 35 || 0,
    motion: feed.motion?.intensity * 25 || 0,
  }));

  const lat = alert.location?.lat;
  const lng = alert.location?.lng;
  const hasCoordinates = typeof lat === 'number' && typeof lng === 'number';

  return (
    <div className="min-h-screen aurora-gradient p-6 relative">
      <div className="aurora-bg" />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="glass-panel border-b border-border/50 px-6 py-4 flex justify-between items-center mb-8">
          <Link
            to="/security"
            className="text-aurora-cyan hover:opacity-80 transition-opacity"
          >
            ← Back to Alerts
          </Link>
          <button
            onClick={() => navigate('/security')}
            className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Alert Info */}
            <div className="glass-panel p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Risk Score: {alert.risk_score.toFixed(1)}
                  </h2>
                  <p className="text-muted-foreground">User: {(alert as any).email}</p>
                  <p className="text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`px-4 py-2 rounded font-semibold ${
                  alert.status === 'resolved' ? 'bg-safe/20 text-safe' :
                  alert.status === 'acknowledged' ? 'bg-warning/20 text-warning' :
                  'bg-danger/20 text-danger'
                }`}>
                  {alert.status.toUpperCase()}
                </span>
              </div>

              {/* Risk Factors */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-secondary/40 border border-border/40 rounded p-4">
                  <div className="text-muted-foreground text-sm mb-1">Audio Stress</div>
                  <div className="text-2xl font-bold text-foreground">{alert.factors.audio.toFixed(1)}</div>
                </div>
                <div className="bg-secondary/40 border border-border/40 rounded p-4">
                  <div className="text-muted-foreground text-sm mb-1">Motion Intensity</div>
                  <div className="text-2xl font-bold text-foreground">{alert.factors.motion.toFixed(1)}</div>
                </div>
                <div className="bg-secondary/40 border border-border/40 rounded p-4">
                  <div className="text-muted-foreground text-sm mb-1">Time Risk</div>
                  <div className="text-2xl font-bold text-foreground">{alert.factors.time.toFixed(1)}</div>
                </div>
                <div className="bg-secondary/40 border border-border/40 rounded p-4">
                  <div className="text-muted-foreground text-sm mb-1">Location Risk</div>
                  <div className="text-2xl font-bold text-foreground">{alert.factors.location.toFixed(1)}</div>
                </div>
              </div>

              {/* Status Actions */}
              {alert.status !== 'resolved' && (
                <div className="mt-6 flex gap-4">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handleStatusUpdate('acknowledged')}
                      disabled={isUpdatingStatus || user?.role !== 'security'}
                      className="px-6 py-2 bg-warning hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusUpdate('resolved')}
                    disabled={isUpdatingStatus || user?.role !== 'security'}
                    className="px-6 py-2 bg-safe hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>

            {/* Attachments */}
            {attachmentPaths.length > 0 || attachmentsLoading ? (
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold text-foreground">Media Attachments</h3>
                  <div className="text-sm text-muted-foreground">
                    {attachmentsLoading ? 'Loading…' : `${attachmentPaths.length} file(s)`}
                  </div>
                </div>

                {attachmentUrls.length === 0 ? (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Attachments were included, but a preview could not be generated. If this persists, add a Storage
                    SELECT policy for bucket <span className="font-semibold">sos-attachment</span> (authenticated users)
                    so Security can create signed URLs.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attachmentUrls.map((url, idx) => {
                      const originalPath = (attachmentPaths[idx] as string | undefined) || '';
                      const looksLikeVideo = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(originalPath);
                      return (
                        <div key={url} className="rounded-xl border border-border/40 bg-secondary/30 overflow-hidden">
                          <div className="px-4 py-3 border-b border-border/40">
                            <div className="text-sm font-semibold text-foreground truncate">{originalPath || `Attachment ${idx + 1}`}</div>
                          </div>
                          <div className="p-3">
                            {looksLikeVideo ? (
                              <video src={url} controls className="w-full max-h-[360px] rounded-lg bg-black" />
                            ) : (
                              <img src={url} alt="Attachment" className="w-full max-h-[360px] object-contain rounded-lg bg-black/20" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Live Feed Chart */}
            {liveFeed.length > 0 && (
              <div className="glass-panel p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">Live Risk Timeline</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(148, 163, 184, 0.2)' }} />
                    <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="audio" stroke="#f59e0b" strokeWidth={1} />
                    <Line type="monotone" dataKey="motion" stroke="#10b981" strokeWidth={1} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Map */}
            <div className="map-container p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">Location</h3>
              <div className="text-muted-foreground mb-4">
                {hasCoordinates ? (
                  <>
                    <div>Latitude: {lat}</div>
                    <div>Longitude: {lng}</div>
                  </>
                ) : (
                  <div>No coordinates available</div>
                )}
              </div>
              <AuroraMap
                sosMarkers={
                  hasCoordinates
                    ? [
                        {
                          id: alert.id,
                          lat,
                          lng,
                          riskScore: alert.risk_score,
                        },
                      ]
                    : []
                }
                height="300px"
                enableGeolocation={false}
              />
            </div>

            {/* Timeline */}
            <div className="glass-panel p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">Event Timeline</h3>
              <EventTimeline sosId={alert.id} sosEvent={alert} />
            </div>

            {/* Chat */}
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-foreground">Chat</h3>
                <div className="text-xs text-muted-foreground">
                  {chatReadOnly || alert.status === 'resolved' ? 'Read-only' : 'Live'}
                </div>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {chatSecurityEmail ? `Responder: ${chatSecurityEmail}` : 'Responder: (unassigned)'}
              </div>

              {chatLoading ? (
                <div className="text-center py-6 text-muted-foreground">Loading chat…</div>
              ) : chatForbidden ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  Only the assigned security responder can access this chat.
                </div>
              ) : chatError ? (
                <div className="mt-3 text-sm text-danger">{chatError}</div>
              ) : null}

              <div className="mt-4 rounded-lg border border-border/40 bg-secondary/30 h-[260px] overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No messages yet.</div>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className="rounded-lg bg-secondary/40 border border-border/40 p-3">
                      <div className="text-xs text-muted-foreground">
                        {m.sender_email || m.sender_id} • {new Date(m.created_at).toLocaleString()}
                      </div>
                      <div className="text-foreground mt-1 whitespace-pre-wrap">{m.message}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex gap-3">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder={chatReadOnly || alert.status === 'resolved' ? 'Chat is read-only (resolved)' : 'Type a message…'}
                  disabled={chatForbidden || chatLoading || chatReadOnly || alert.status === 'resolved'}
                  className="flex-1 px-4 py-3 rounded-lg border border-border bg-card/50 text-foreground backdrop-blur-sm focus:outline-none focus:border-primary/50 disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={sendChatMessage}
                  disabled={chatForbidden || chatLoading || chatReadOnly || alert.status === 'resolved' || !chatDraft.trim()}
                  className="px-5 py-3 bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg border border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Live Feed Stats */}
            {liveFeed.length > 0 && (
              <div className="glass-panel p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">Live Feed</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">Current Risk</div>
                    <div className="text-2xl font-bold text-foreground">
                      {liveFeed[liveFeed.length - 1]?.totalRisk?.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">Audio RMS</div>
                    <div className="text-lg text-foreground">
                      {liveFeed[liveFeed.length - 1]?.audio?.rms?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">Motion</div>
                    <div className="text-lg text-foreground">
                      {liveFeed[liveFeed.length - 1]?.motion?.acceleration?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
