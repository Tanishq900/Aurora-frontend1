import { useEffect, useState } from 'react';
import { SOSEvent } from '../services/sos.service';
import { sosService } from '../services/sos.service';
import { AlertTriangle, Bot, CheckCircle2, CheckCircle, MapPin } from 'lucide-react';

interface EventTimelineProps {
  events?: Array<{
    type: 'sos_triggered' | 'ai_risk' | 'zone_entered' | 'acknowledged' | 'resolved';
    timestamp: string;
    data?: any;
  }>;
  sosEvent?: SOSEvent;
  sosId?: string | { id?: string } | null; // If provided, fetch events from API
}

interface TimelineEvent {
  id: string;
  sos_id: string;
  type: string;
  risk_value: number | null;
  meta: any;
  timestamp: string;
}

export default function EventTimeline({ events, sosEvent, sosId }: EventTimelineProps) {
  const [fetchedEvents, setFetchedEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch events from API if sosId is provided
  useEffect(() => {
    // Ensure sosId is a string, not an object
    const validSosId = typeof sosId === 'string' ? sosId : sosId?.id || null;
    if (validSosId) {
      setLoading(true);
      sosService
        .getSOSEventHistory(String(validSosId))
        .then((data) => {
          setFetchedEvents(data);
        })
        .catch((error) => {
          console.error('Failed to fetch SOS events:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [sosId]);

  // Use fetched events if available, otherwise use provided events or build from sosEvent
  let timelineEvents: Array<{
    type: string;
    timestamp: string;
    data?: any;
    risk_value?: number | null;
  }> = [];

  if (fetchedEvents.length > 0) {
    // Use fetched events from API
    timelineEvents = fetchedEvents.map((event) => ({
      type: event.type,
      timestamp: event.timestamp,
      data: event.meta,
      risk_value: event.risk_value,
    }));
  } else if (events && events.length > 0) {
    // Use provided events
    timelineEvents = events;
  } else if (sosEvent) {
    // Build from SOS event (fallback)
    timelineEvents = [
      {
        type: 'sos_triggered',
        timestamp: sosEvent.created_at,
        data: { triggerType: sosEvent.trigger_type, riskScore: sosEvent.risk_score },
      },
      ...(sosEvent.status === 'acknowledged' || sosEvent.status === 'resolved'
        ? [
            {
              type: sosEvent.status,
              timestamp: sosEvent.updated_at,
              data: {},
            },
          ]
        : []),
    ];
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'sos_triggered':
        return <AlertTriangle className="h-4 w-4 text-danger" />;
      case 'ai_risk':
        return <Bot className="h-4 w-4 text-aurora-cyan" />;
      case 'zone_entered':
        return <MapPin className="h-4 w-4 text-aurora-emerald" />;
      case 'acknowledged':
        return <CheckCircle2 className="h-4 w-4 text-warning" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-safe" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-border" />;
    }
  };

  const getEventLabel = (type: string, data?: any, riskValue?: number | null) => {
    switch (type) {
      case 'sos_triggered': {
        const triggerType = data?.trigger_type || data?.triggerType;
        const risk = riskValue ?? data?.riskScore ?? data?.risk_value;
        const hasRisk = risk !== null && risk !== undefined;
        return `SOS ${triggerType === 'ai' ? 'Auto-Triggered' : 'Manually Triggered'}${hasRisk ? ` (Risk: ${typeof risk === 'number' ? risk.toFixed(1) : risk})` : ''}`;
      }
      case 'ai_risk': {
        const hasRisk = riskValue !== null && riskValue !== undefined;
        return `AI Risk Level Changed${hasRisk ? ` (Risk: ${riskValue.toFixed(1)})` : ''}`;
      }
      case 'zone_entered': {
        if (data?.normal_zone) {
          return 'User is outside all predefined risk zones (Normal area)';
        }
        const zoneName = data?.zoneName || data?.zone_name || 'Unknown';
        const zoneType = data?.zoneType || data?.zone_type || (data?.type === 'high' ? 'high-risk' : 'low-risk');
        return `Entered ${zoneType} zone: ${zoneName}`;
      }
      case 'acknowledged':
        return data?.security_name
          ? `Security Acknowledged by ${data.security_name}`
          : data?.security_email
            ? `Security Acknowledged by ${data.security_email}`
            : 'Security Acknowledged';
      case 'resolved':
        return data?.security_name
          ? `Security Resolved by ${data.security_name}`
          : data?.security_email
            ? `Security Resolved by ${data.security_email}`
            : 'Security Resolved';
      default:
        return 'Event';
    }
  };

  const formatTimestamp = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString();
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-slate-400">
        Loading events...
      </div>
    );
  }

  if (timelineEvents.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No events to display
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-6">
        {timelineEvents.map((event, index) => (
          <div key={index} className="relative flex items-start gap-4">
            {index !== timelineEvents.length - 1 ? (
              <div className="absolute left-4 top-8 h-[calc(100%-8px)] w-0.5 bg-border/70" />
            ) : null}
            {/* Icon */}
            <div
              className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border border-border/60 bg-secondary/30 backdrop-blur shadow-[0_0_18px_rgba(0,0,0,0.35)]`}
            >
              {getEventIcon(event.type)}
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="text-white font-medium">
                {getEventLabel(event.type, event.data, event.risk_value)}
              </div>
              <div className="text-slate-400 text-sm mt-1">
                {formatTimestamp(event.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
