import { create } from "zustand";

type ShortLinksDialogState = {
  actions: {
    setOpen: (open: boolean) => void;
  };
  isOpen: boolean;
};

const useStore = create<ShortLinksDialogState>((set) => ({
  actions: {
    setOpen: (open) => set({ isOpen: open }),
  },
  isOpen: false,
}));

export const useShortLinksDialogActions = () => useStore((s) => s.actions);
export const useShortLinksDialogIsOpen = () => useStore((s) => s.isOpen);
