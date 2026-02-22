import { create } from "zustand";

type CreateRepoDialogState = {
  closeDialog: () => void;
  open: boolean;
  openDialog: () => void;
};

export const useCreateRepoDialogStore = create<CreateRepoDialogState>((set) => ({
  closeDialog: () => set({ open: false }),
  open: false,
  openDialog: () => set({ open: true }),
}));
