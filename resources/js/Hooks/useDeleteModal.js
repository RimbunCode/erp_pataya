import { create } from "zustand";

const useDeleteModal = create((set) => ({
  isOpen: false,
  route: null,
  id: null,
  deleteItem(route, id, attributes = {}) {
    set({ isOpen: true, route, id, attributes });
  },
  close: () => set({ isOpen: false, route: null, id: null }),
}));

export default useDeleteModal;
