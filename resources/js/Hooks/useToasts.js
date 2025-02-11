import { create } from "zustand";

const useToasts = create((set) => ({
  toasts: [],
  addToast: ({ type, title, message, timeout = 5000 }) =>
    set((state) => ({
      toasts: [
        { type, title, message, timeout, id: Date.now() },
        ...state.toasts,
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));

export default useToasts;
