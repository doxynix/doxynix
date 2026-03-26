import { create } from "zustand";

type RepoBranchState = {
  actions: {
    setOpen: (open: boolean) => void;
  };
  open: boolean;
};

const useStore = create<RepoBranchState>((set) => ({
  actions: {
    setOpen: (open) => set({ open }),
  },
  open: false,
}));

export const useRepoBranchOpen = () => useStore((s) => s.open);
export const useRepoBranchActions = () => useStore((s) => s.actions);
