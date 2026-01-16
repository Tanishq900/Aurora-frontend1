import { api } from './api';

export interface WeeklyAlertsData {
  labels: string[];
  sos: number[];
  ai: number[];
  kpis: {
    totalSOS: number;
    totalAI: number;
    peakDay: string;
    highestAIRisk: number;
  };
}

export const analyticsService = {
  async getWeeklyAlerts(): Promise<WeeklyAlertsData> {
    const response = await api.get('/analytics/alerts/week');
    return response.data;
  },
};
