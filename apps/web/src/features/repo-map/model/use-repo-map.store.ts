import { create } from "zustand";

type MapUiState = {
  actions: {
    setHideControls: (value: boolean) => void;
    toggleControls: () => void;
  };
  hideControls: boolean;
};

const useStore = create<MapUiState>((set) => ({
  actions: {
    setHideControls: (value) => set({ hideControls: value }),
    toggleControls: () => set((state) => ({ hideControls: !state.hideControls })),
  },
  hideControls: false,
}));

export const useMapControlsHide = () => useStore((s) => s.hideControls);
export const useMapControlsActions = () => useStore((s) => s.actions);
