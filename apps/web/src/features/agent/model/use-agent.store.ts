import { create } from "zustand";

type AgentState = {
  actions: {
    closeAgent: () => void;
    openAgent: () => void;
  };
  isOpen: boolean;
};

export const useStore = create<AgentState>((set) => ({
  actions: {
    closeAgent: () => set({ isOpen: false }),
    openAgent: () => set({ isOpen: true }),
  },
  isOpen: false,
}));

export const useAgentIsOpen = () => useStore((s) => s.isOpen);
export const useAgentClose = () => useStore((s) => s.actions.closeAgent);
export const useAgentOpen = () => useStore((s) => s.actions.openAgent);
