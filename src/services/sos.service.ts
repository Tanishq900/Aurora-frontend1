import api from './api';

export interface SOSEvent {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
  risk_score: number;
  factors: {
    audio: number;
    motion: number;
    time: number;
    location: number;
  };
  location?: {
    lat?: number | string;
    lng?: number | string;
    address?: string;
  };
  trigger_type: 'manual' | 'ai';
  status: 'new' | 'acknowledged' | 'resolved';
  attachments?: string[];
  attachment_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateSOSData {
  risk_score: number;
  factors: {
    audio: number;
    motion: number;
    time: number;
    location: number;
  };
  location?: any;
  trigger_type?: 'manual' | 'ai';
  attachments?: string[];
}

export interface SOSChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_email?: string;
  sender_name?: string;
  sos_id?: string;
}

export interface SOSChatBundle {
  sos: SOSEvent;
  chat: {
    id: string;
    sos_id: string;
    student_id: string;
    security_id: string | null;
    security_email?: string;
    security_name?: string;
    created_at: string;
    updated_at: string;
  };
  read_only: boolean;
  messages: SOSChatMessage[];
}

export const sosService = {
  async uploadAttachments(files: File[]): Promise<{ paths: string[]; bucket?: string }> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    const response = await api.post('/sos/attachments', form);
    return response.data;
  },

  async createSOS(data: CreateSOSData): Promise<SOSEvent> {
    const response = await api.post('/sos', data);
    return response.data;
  },

  async getRecentSOSChat(): Promise<SOSChatBundle> {
    const response = await api.get('/sos/recent/chat');
    return response.data;
  },

  async getSOSEvents(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<SOSEvent[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await api.get(`/sos?${params.toString()}`);
    return response.data;
  },

  async getSOSById(id: string): Promise<SOSEvent> {
    const response = await api.get(`/sos/${id}`);
    return response.data;
  },

  async getSOSChatById(id: string): Promise<SOSChatBundle> {
    const response = await api.get(`/sos/${id}/chat`);
    return response.data;
  },

  async sendSOSChatMessage(id: string, message: string): Promise<SOSChatMessage> {
    const response = await api.post(`/sos/${id}/chat/messages`, { message });
    return response.data;
  },

  async updateStatus(id: string, status: 'acknowledged' | 'resolved'): Promise<SOSEvent> {
    const response = await api.patch(`/sos/${id}/status`, { status });
    return response.data;
  },

  async clearHistory(): Promise<{ message: string; deleted: number }> {
    const response = await api.delete('/sos/history');
    return response.data;
  },

  async getSOSEventHistory(sosId: string): Promise<Array<{
    id: string;
    sos_id: string;
    type: string;
    risk_value: number | null;
    meta: any;
    timestamp: string;
  }>> {
    const response = await api.get(`/sos/${sosId}/events`);
    return response.data;
  },
};
