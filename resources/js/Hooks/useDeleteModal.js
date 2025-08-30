import { create } from "zustand";

const useDeleteModal = create((set) => ({
  isOpen: false,
  route: null,
  id: null,
  deleteItem(route, id) {
    set({ isOpen: true, route, id });
  },
  close: () => set({ isOpen: false, route: null, id: null }),
}));

export default useDeleteModal;
