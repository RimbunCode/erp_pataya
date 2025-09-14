import { create } from "zustand";

export const useIsDirtyForm = create((set) => ({
  isDirty: false,
  setIsDirty: (value) => set({ isDirty: value }),
  processing: false,
  setProcessing: (value) => set({ processing: value }),
  recentlySuccessful: false,
  setRecentlySuccessful: (value) => set({ recentlySuccessful: value }),
  showAlert: false,
  setShowAlert: (value) => set({ showAlert: value }),
  cancel: () => {},
  setCancel: (value) => set({ cancel: value }),
  leave: () => {},
  setLeave: (value) => set({ leave: value }),
  saveAsDraft: () => {},
  setSaveAsDraft: (value) => set({ saveAsDraft: value }),
}));
