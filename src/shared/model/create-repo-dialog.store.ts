import { create } from "zustand";

type CreateRepoDialogState = {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
};

export const useCreateRepoDialogStore = create<CreateRepoDialogState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));
