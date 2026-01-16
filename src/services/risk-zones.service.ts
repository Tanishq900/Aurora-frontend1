import { api } from './api';

export interface RiskZone {
  id: string;
  name: string;
  type: 'high' | 'low';
  polygon: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  multiplier: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const riskZonesService = {
  async getRiskZones(): Promise<RiskZone[]> {
    const response = await api.get('/risk-zones');
    return response.data;
  },
};
