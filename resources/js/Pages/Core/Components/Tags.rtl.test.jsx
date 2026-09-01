import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil -- Tags.jsx TIDAK punya useEffect ber-dependency `t`, tapi
// tetap dipakai konstan (bukan arrow function baru tiap panggil) mengikuti
// pola acuan agar tidak jadi kebiasaan buruk yang menular ke komponen lain.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerPost = vi.fn();
const routerDelete = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: {
    post: (...a) => routerPost(...a),
    delete: (...a) => routerDelete(...a),
  },
  // Deferred cukup dirender langsung sebagai children -- fallback loading
  // bukan concern komponen ini.
  Deferred: ({ children }) => children,
}));

// Tags.jsx merender tiap chip tag sebagai <Link> (Components/Link.jsx) ke
// halaman detail tag. Link.jsx sendiri memakai `router`/`shouldIntercept`
// dari @inertiajs/core (BUKAN @inertiajs/react) -- tanpa mock ini, klik pada
// chip (mis. tersentuh tidak sengaja lewat query text yang match beberapa
// elemen) memicu router.visit ASLI yang crash di luar konteks Inertia nyata.
vi.mock("@inertiajs/core", async () => {
  const actual = await vi.importActual("@inertiajs/core");
  return { ...actual, router: { visit: vi.fn(), prefetch: vi.fn() } };
});

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...a) => toastError(...a) },
}));

// useFormPage bisa undefined (di luar FormPageContext) atau berisi
// {isCreate, data, setData}.
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...a) => useFormPageMock(...a),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import Tags from "./Tags";

describe("Tags", () => {
  beforeEach(() => {
    routerPost.mockReset();
    routerDelete.mockReset();
    axiosGet.mockReset();
    toastError.mockReset();
    useFormPageMock.mockReset();
    useFormPageMock.mockReturnValue(undefined);
    usePageMock.mockReturnValue({ props: { tags: [] } });
    axiosGet.mockResolvedValue({ data: [] });
  });

  it("mode edit: menampilkan daftar tag dari shared props", () => {
    usePageMock.mockReturnValue({
      props: {
        tags: [
          { id: 1, name: "urgent" },
          { id: 2, name: "review" },
        ],
      },
    });

    render(<Tags />);

    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
  });

  it("mode create: menampilkan tag dari buffer form (data.buffered_tags)", () => {
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: { buffered_tags: [{ id: 5, name: "draft-tag" }] },
      setData: vi.fn(),
    });
    usePageMock.mockReturnValue({
      props: { tags: [{ id: 999, name: "harus-tidak-tampil" }] },
    });

    render(<Tags />);

    expect(screen.getByText("draft-tag")).toBeInTheDocument();
    expect(screen.queryByText("harus-tidak-tampil")).not.toBeInTheDocument();
  });

  it("klik tombol Plus membuka search box tag", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Tags />);

    expect(
      screen.queryByPlaceholderText("TR:core.form.tag.search"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    expect(
      screen.getByPlaceholderText("TR:core.form.tag.search"),
    ).toBeInTheDocument();
  });

  it("mengetik search memanggil axios.get ke tags.index setelah debounce", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    axiosGet.mockResolvedValue({
      data: [{ id: 10, name: "penting" }],
    });

    render(<Tags />);
    await user.click(screen.getByRole("button"));
    await user.type(
      screen.getByPlaceholderText("TR:core.form.tag.search"),
      "pent",
    );

    await vi.advanceTimersByTimeAsync(500);

    expect(axiosGet).toHaveBeenCalled();
    const calledUrl = axiosGet.mock.calls[0][0];
    expect(calledUrl).toContain("tags.index");
    expect(calledUrl).toContain("search=pent");

    vi.useRealTimers();
  });

  it("axios.get gagal saat search menampilkan toast error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    axiosGet.mockRejectedValue(new Error("network error"));

    render(<Tags />);
    await user.click(screen.getByRole("button"));
    await user.type(
      screen.getByPlaceholderText("TR:core.form.tag.search"),
      "x",
    );

    await vi.advanceTimersByTimeAsync(500);
    // flush microtask promise rejection handler
    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("TR:core.errors.fetch_failed"),
    );

    vi.useRealTimers();
  });

  it("mode edit: memilih tag hasil pencarian memanggil router.post ke basePath/tag", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    axiosGet.mockResolvedValue({
      data: [{ id: 20, name: "important" }],
    });

    render(<Tags />);
    await user.click(screen.getByRole("button"));
    await user.type(
      screen.getByPlaceholderText("TR:core.form.tag.search"),
      "impor",
    );
    await vi.advanceTimersByTimeAsync(500);

    vi.useRealTimers();
    const option = await screen.findByText("important");
    await user.click(option);

    expect(routerPost).toHaveBeenCalledTimes(1);
    const [calledPath, payload, options] = routerPost.mock.calls[0];
    expect(calledPath).toMatch(/\/tag$/);
    expect(payload).toEqual(
      expect.objectContaining({ id: 20, name: "important" }),
    );
    expect(options).toEqual(
      expect.objectContaining({
        reset: ["tags"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      }),
    );
  });

  it("mode create: memilih tag hasil pencarian menyimpan ke buffered_tags via setData (bukan router.post)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: { buffered_tags: [] },
      setData,
    });
    axiosGet.mockResolvedValue({
      data: [{ id: 30, name: "baru", isNew: true }],
    });

    render(<Tags />);
    await user.click(screen.getByRole("button"));
    await user.type(
      screen.getByPlaceholderText("TR:core.form.tag.search"),
      "baru",
    );
    await vi.advanceTimersByTimeAsync(500);

    vi.useRealTimers();
    const option = await screen.findByText("baru");
    await user.click(option);

    expect(setData).toHaveBeenCalledWith("buffered_tags", [
      { id: 30, name: "baru", isNew: true },
    ]);
    expect(routerPost).not.toHaveBeenCalled();
  });

  it("mode edit: klik X pada tag memanggil router.delete ke basePath/tag/{id}", async () => {
    const user = userEvent.setup({ delay: null });
    usePageMock.mockReturnValue({
      props: { tags: [{ id: 7, name: "hapus-saya" }] },
    });

    render(<Tags />);

    const tagChip = screen.getByText("hapus-saya").closest("div");
    await user.click(tagChip.querySelector("button"));

    expect(routerDelete).toHaveBeenCalledTimes(1);
    const [calledPath, options] = routerDelete.mock.calls[0];
    expect(calledPath).toMatch(/\/tag\/7$/);
    expect(options).toEqual(
      expect.objectContaining({
        reset: ["tags"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      }),
    );
  });

  it("mode create: klik X pada tag menghapus dari buffer via setData (bukan router.delete)", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: {
        buffered_tags: [
          { id: 1, name: "tag-a" },
          { id: 2, name: "tag-b" },
        ],
      },
      setData,
    });

    render(<Tags />);

    const tagChip = screen.getByText("tag-a").closest("div");
    await user.click(tagChip.querySelector("button"));

    expect(setData).toHaveBeenCalledWith("buffered_tags", [
      { id: 2, name: "tag-b" },
    ]);
    expect(routerDelete).not.toHaveBeenCalled();
  });

  it("menambah tag yang namanya sudah ada di daftar tidak memanggil router.post/setData", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    usePageMock.mockReturnValue({
      props: { tags: [{ id: 1, name: "sudah-ada" }] },
    });
    axiosGet.mockResolvedValue({
      data: [{ id: 1, name: "sudah-ada" }],
    });

    render(<Tags />);
    // Sudah ada 1 tag terpasang (chip dengan tombol hapus) -- tombol toggle
    // pencarian (Plus) adalah button pertama di header.
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(
      screen.getByPlaceholderText("TR:core.form.tag.search"),
      "sudah",
    );
    await vi.advanceTimersByTimeAsync(500);

    vi.useRealTimers();
    const options = await screen.findAllByText("sudah-ada");
    // options[0] adalah chip tag yang sudah ada; ambil item command list (yang
    // terakhir, dirender dalam dropdown pencarian).
    const commandItem = options[options.length - 1];
    await user.click(commandItem);

    expect(routerPost).not.toHaveBeenCalled();
  });
});
