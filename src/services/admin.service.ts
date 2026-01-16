import api from './api';

export interface AdminSecurityUser {
  id: string;
  email: string;
  name: string;
  role: 'security';
  security_approved: boolean;
  created_at: string;
}

export const adminService = {
  async listSecurityUsers(status?: 'pending' | 'approved' | 'all'): Promise<AdminSecurityUser[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);

    const response = await api.get(`/admin/security-users?${params.toString()}`);
    return response.data.users;
  },

  async approveSecurityUser(id: string): Promise<AdminSecurityUser> {
    const response = await api.patch(`/admin/security-users/${id}/approve`);
    return response.data.user;
  },

  async deleteSecurityUser(id: string): Promise<void> {
    await api.delete(`/admin/security-users/${id}`);
  },
};
