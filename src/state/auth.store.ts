import { create } from 'zustand';
import { authService, User } from '../services/auth.service';
import { logger } from '../lib/logger';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: 'student' | 'security') => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      set({ user: response.user, isAuthenticated: true });
    } catch (error: any) {
      // Extract backend error message (supports both 'message' and 'error' fields)
      const backendError = error.response?.data?.message || error.response?.data?.error || error.message || 'Login failed';
      throw new Error(backendError);
    }
  },

  register: async (email: string, password: string, name: string, role = 'student') => {
    try {
      await authService.register({ email, password, role, name });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = await authService.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      logger.warn('Auth check failed:', error.message || error);
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user: User | null) => {
    set({ user, isAuthenticated: !!user });
  },
}));
