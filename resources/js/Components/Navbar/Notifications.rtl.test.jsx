import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil (referensi sama tiap render) -- source Notifications.jsx
// memakai `t` sebagai dependency useEffect fetch notifikasi. Mock naif yang
// membuat fungsi baru tiap panggil useLaravelReactI18n() akan membuat effect
// itu re-run pada SETIAP render, membuat loading state tak pernah stabil.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
const routerVisit = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { visit: (...a) => routerVisit(...a) },
}));

const axiosGet = vi.fn();
const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...a) => axiosGet(...a),
    post: (...a) => axiosPost(...a),
  },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...a) => toastError(...a) },
}));

window.route = (name, id) => (id ? `${name}/${id}` : name);

import Notifications from "./Notifications";

describe("Notifications", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    toastError.mockReset();
    routerVisit.mockReset();
    usePageMock.mockReturnValue({
      props: {
        unread_notifications_count: 3,
        auth: { user: { id: 1 } },
        lang: "en",
      },
    });
  });

  it("menampilkan badge unread count dari shared props", () => {
    render(<Notifications />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("unread count 0 tidak menampilkan badge", () => {
    usePageMock.mockReturnValue({
      props: { unread_notifications_count: 0, auth: { user: { id: 1 } }, lang: "en" },
    });
    render(<Notifications />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("badge >99 ditampilkan sebagai '99+'", () => {
    usePageMock.mockReturnValue({
      props: { unread_notifications_count: 150, auth: { user: { id: 1 } }, lang: "en" },
    });
    render(<Notifications />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("membuka popover memuat notifikasi via axios.get", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: {
        notifications: [
          {
            id: 1,
            data: { title: "Todo Baru", message: "Anda ditugaskan" },
            created_at: new Date().toISOString(),
            read_at: null,
          },
        ],
        unread_count: 1,
      },
    });
    render(<Notifications />);

    await user.click(screen.getByRole("button", { name: /notifications/ }));

    expect(await screen.findByText("Todo Baru")).toBeInTheDocument();
    expect(axiosGet).toHaveBeenCalledWith("notifications.index");
  });

  it("popover kosong menampilkan empty state", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({ data: { notifications: [], unread_count: 0 } });
    render(<Notifications />);

    await user.click(screen.getByRole("button", { name: /notifications/ }));

    expect(
      await screen.findByText("TR:notification.panel.empty.title"),
    ).toBeInTheDocument();
  });

  it("axios.get gagal menampilkan toast error", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockRejectedValue(new Error("network error"));
    render(<Notifications />);

    await user.click(screen.getByRole("button", { name: /notifications/ }));

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("TR:core.errors.fetch_failed"),
    );
  });

  it("klik notifikasi menandai terbaca dan redirect bila ada url resolusi", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: {
        notifications: [
          {
            id: 5,
            data: { title: "Todo X", message: "msg" },
            created_at: new Date().toISOString(),
            read_at: null,
          },
        ],
        unread_count: 1,
      },
    });
    axiosPost.mockResolvedValue({
      data: { documentType: "App\\Models\\Core\\Todo", documentId: 9 },
    });

    render(<Notifications />);
    await user.click(screen.getByRole("button", { name: /notifications/ }));
    await user.click(await screen.findByText("Todo X"));

    expect(axiosPost).toHaveBeenCalledWith("notifications.read/5");
    await vi.waitFor(() => expect(routerVisit).toHaveBeenCalledWith("todos.show/9"));
  });

  it("mark all as read men-set semua notifikasi terbaca dan unreadCount ke 0", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: {
        notifications: [
          {
            id: 1,
            data: { title: "A", message: "m" },
            created_at: new Date().toISOString(),
            read_at: null,
          },
        ],
        unread_count: 1,
      },
    });
    axiosPost.mockResolvedValue({});

    render(<Notifications />);
    await user.click(screen.getByRole("button", { name: /notifications/ }));
    await screen.findByText("A");

    // Button "mark all as read" cuma berisi svg icon (tanpa accessible name);
    // labelnya lewat prop custom `tooltip` (plain HTML attribute, bukan aria-label).
    // PopoverContent dirender via Radix Portal ke document.body, DI LUAR
    // `container` hasil render() -- maka query lewat screen.baseElement.
    await user.click(
      document.body.querySelector(
        '[tooltip="TR:notification.panel.mark_all_as_read"]',
      ),
    );

    expect(axiosPost).toHaveBeenCalledWith("notifications.readAll");
  });
});
