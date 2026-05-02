import { create } from "zustand";

type CommandMenuState = {
  actions: {
    setOpen: (open: boolean) => void;
    toggle: () => void;
  };
  isOpen: boolean;
};

const useStore = create<CommandMenuState>((set) => ({
  actions: {
    setOpen: (open) => set({ isOpen: open }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  },
  isOpen: false,
}));

export const useCommandMenuIsOpen = () => useStore((s) => s.isOpen);
export const useCommandMenuActions = () => useStore((s) => s.actions);
