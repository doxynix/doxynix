import { create } from "zustand";

type CreateRepoDialogStore = {
  actions: {
    setOpen: (open: boolean) => void;
  };
  open: boolean;
};

const useStore = create<CreateRepoDialogStore>((set) => ({
  actions: {
    setOpen: (open) => set({ open }),
  },
  open: false,
}));

export const useCreateRepoOpen = () => useStore((s) => s.open);
export const useCreateRepoActions = () => useStore((s) => s.actions);
