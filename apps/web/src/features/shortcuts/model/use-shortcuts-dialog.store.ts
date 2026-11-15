import { create } from "zustand";

type ShortcutsDialogState = {
  actions: {
    setOpen: (open: boolean) => void;
    toggle: () => void;
  };
  isOpen: boolean;
};

const useStore = create<ShortcutsDialogState>((set) => ({
  actions: {
    setOpen: (open) => set({ isOpen: open }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  },
  isOpen: false,
}));

export const useShortcutsDialogActions = () => useStore((s) => s.actions);
export const useShortcutsDialogIsOpen = () => useStore((s) => s.isOpen);
