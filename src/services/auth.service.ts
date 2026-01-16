import api from './api';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'student' | 'security' | 'admin';
  is_verified?: boolean;
  security_approved?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  role?: 'student' | 'security';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authService = {
  async register(data: RegisterData): Promise<User> {
    const response = await api.post('/auth/register', data);
    return response.data.user;
  },

  async verifyOTP(userId: string, otp: string): Promise<void> {
    await api.post('/auth/verify', { userId, otp });
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data);
    localStorage.setItem('accessToken', response.data.accessToken);
    return response.data;
  },

  async createLocalUser(data: RegisterData): Promise<void> {
    await api.post('/auth/create-local-user', data);
  },

  async me(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data.user;
  },

  logout(): void {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  },
};
