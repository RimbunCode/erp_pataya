import { create } from "zustand";

export const useIsDirtyForm = create((set) => ({
  isDirty: false,
  setIsDirty: (value) => set({ isDirty: value }),
  showAlert: false,
  setShowAlert: (value) => set({ showAlert: value }),
  cancel: () => {},
  setCancel: (value) => set({ cancel: value }),
  continue: () => {
    console.log("sadsd");
  },
  setContinue: (value) => set({ continue: value }),
}));
