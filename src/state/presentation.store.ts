import { create } from 'zustand';

const PRESENTATION_MODE_STORAGE_KEY = 'presentationModeEnabled';

interface PresentationState {
  enabled: boolean;
  isLoading: boolean;
  fetchStatus: () => Promise<void>;
  toggle: (enabled: boolean, password: string) => Promise<void>;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  enabled: false,
  isLoading: false,

  fetchStatus: async () => {
    try {
      const raw = localStorage.getItem(PRESENTATION_MODE_STORAGE_KEY);
      set({ enabled: raw === 'true' });
    } catch (error) {
      console.error('Failed to fetch presentation mode status:', error);
    }
  },

  toggle: async (enabled: boolean, password: string) => {
    set({ isLoading: true });
    try {
      void password;
      localStorage.setItem(PRESENTATION_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
      set({ enabled, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to toggle presentation mode');
    }
  },
}));
