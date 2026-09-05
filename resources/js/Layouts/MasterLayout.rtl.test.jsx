import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePageMock = vi.fn();
const setLocaleMock = vi.fn();
const mockUseTheme = vi.fn();
const useIsDirtyFormMock = vi.fn();
const useAlertDraftFormMock = vi.fn();

vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key) => key,
    setLocale: (...args) => setLocaleMock(...args),
  }),
}));

vi.mock("@/Hooks/useTheme", () => ({
  default: () => mockUseTheme(),
}));

vi.mock("@/Hooks/useDraftForm", () => ({
  useAlertDraftForm: () => useAlertDraftFormMock(),
}));

vi.mock("@/Hooks/useIsDirtyForm", () => ({
  useIsDirtyForm: () => useIsDirtyFormMock(),
}));

// DeleteDialog punya dependency berat sendiri (useDeleteModal, FormInput,
// PasswordInput, window.route) yang tidak relevan dengan logic MasterLayout
// -- di-stub biar fokus ke behavior MasterLayout sendiri.
vi.mock("./AlertDialogs/DeleteDialog", () => ({
  default: () => <div data-testid="delete-dialog-mock" />,
}));

import MasterLayout from "./MasterLayout";

function setDirtyFormStore(overrides = {}) {
  useIsDirtyFormMock.mockReturnValue({
    showAlert: false,
    setShowAlert: vi.fn(),
    cancel: vi.fn(),
    leave: vi.fn(),
    saveAsDraft: vi.fn(),
    setIsDirty: vi.fn(),
    ...overrides,
  });
}

function setDraftFormStore(overrides = {}) {
  useAlertDraftFormMock.mockReturnValue({
    showAlert: false,
    setShowAlert: vi.fn(),
    cancel: vi.fn(),
    continue: vi.fn(),
    ...overrides,
  });
}

function setPage({ lang, debug = false, url = "/" } = {}) {
  usePageMock.mockReturnValue({ props: { lang, debug }, url });
}

// Helper mock window.matchMedia yang bisa memicu event "change" secara
// manual -- pola sama dgn Hooks/use-tablet.dom.test.js.
function mockMatchMedia() {
  const listeners = new Set();
  const addEventListener = vi.fn((event, cb) => {
    if (event === "change") listeners.add(cb);
  });
  const removeEventListener = vi.fn((event, cb) => {
    if (event === "change") listeners.delete(cb);
  });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener,
    removeEventListener,
  }));
  return {
    // dibungkus act(): AlertDialogContent (via useIsMobile()) juga selalu
    // ter-mount dan mendaftar listener "change" pada matchMedia yang sama
    // (query string diabaikan oleh mock ini) -- trigger jadi memicu state
    // update React sungguhan pada useIsMobile, bukan cuma mock kita.
    trigger: (matches) => {
      act(() => {
        listeners.forEach((cb) => cb({ matches }));
      });
    },
    addEventListener,
    removeEventListener,
  };
}

const originalMatchMedia = window.matchMedia;

describe("MasterLayout", () => {
  beforeEach(() => {
    usePageMock.mockReset();
    setLocaleMock.mockReset();
    mockUseTheme.mockReset();
    useIsDirtyFormMock.mockReset();
    useAlertDraftFormMock.mockReset();

    setPage();
    setDirtyFormStore();
    setDraftFormStore();
    mockUseTheme.mockReturnValue({
      theme: "light",
      currentTheme: "light",
      setCurrentTheme: vi.fn(),
    });

    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove("dark");
  });

  describe("render dasar", () => {
    it("merender children di dalam TooltipProvider", () => {
      render(
        <MasterLayout>
          <div>Konten Halaman</div>
        </MasterLayout>,
      );

      expect(screen.getByText("Konten Halaman")).toBeInTheDocument();
    });

    it("selalu merender DeleteDialog", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(screen.getByTestId("delete-dialog-mock")).toBeInTheDocument();
    });
  });

  describe("pembersihan localStorage kadaluarsa saat mount", () => {
    // MasterLayout.jsx memakai `Object.entries(localStorage)` untuk
    // meng-iterasi entry tersimpan (lihat baris ~118). Di browser asli,
    // localStorage adalah legacy platform object -- setiap key yang
    // disimpan lewat setItem() muncul sebagai own-enumerable property,
    // sedangkan method (getItem/setItem/dst) ada di prototype (tidak ikut
    // ter-enumerate). Polyfill global di test-setup.js (Map-backed, method
    // sbg property object biasa) TIDAK meniru semantik ini -- Object.entries
    // pada polyfill itu cuma mengembalikan 4 nama method, bukan data yang
    // disimpan lewat setItem, sehingga efek pembersihan mount-time tidak
    // pernah benar-benar teruji. Override localStorage lokal di describe
    // block ini dengan mock yang meniru semantik asli (data sbg
    // own-enumerable prop, method non-enumerable) khusus utk skenario ini.
    const originalLocalStorage = globalThis.localStorage;

    function createEnumerableLocalStorageMock() {
      const store = {};
      const methods = {
        getItem: (key) =>
          Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
        setItem: (key, value) => {
          store[key] = String(value);
        },
        removeItem: (key) => {
          delete store[key];
        },
        clear: () => {
          Object.keys(store).forEach((key) => delete store[key]);
        },
      };
      Object.keys(methods).forEach((name) => {
        Object.defineProperty(store, name, {
          value: methods[name],
          enumerable: false,
          configurable: true,
        });
      });
      return store;
    }

    beforeEach(() => {
      globalThis.localStorage = createEnumerableLocalStorageMock();
    });

    afterEach(() => {
      globalThis.localStorage = originalLocalStorage;
    });

    it("menghapus entry yang expiredDate-nya sudah lewat", () => {
      const expired = new Date(Date.now() - 60_000).toISOString();
      localStorage.setItem(
        "draft_expired",
        JSON.stringify({ expiredDate: expired, value: "x" }),
      );

      render(<MasterLayout>child</MasterLayout>);

      expect(localStorage.getItem("draft_expired")).toBeNull();
    });

    it("tidak menghapus entry yang masih berlaku (expiredDate di masa depan)", () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      localStorage.setItem(
        "draft_valid",
        JSON.stringify({ expiredDate: future, value: "x" }),
      );

      render(<MasterLayout>child</MasterLayout>);

      expect(localStorage.getItem("draft_valid")).not.toBeNull();
    });

    it("tidak crash dan tidak menghapus entry yang bukan JSON valid (JSON.parse gagal)", () => {
      localStorage.setItem("bukan_json", "plain-string-{tidak-valid");

      expect(() => render(<MasterLayout>child</MasterLayout>)).not.toThrow();
      expect(localStorage.getItem("bukan_json")).toBe(
        "plain-string-{tidak-valid",
      );
    });
  });

  describe("efek tema: class 'dark' pada documentElement", () => {
    it("menambahkan class 'dark' saat currentTheme='dark'", () => {
      mockUseTheme.mockReturnValue({
        theme: "dark",
        currentTheme: "dark",
        setCurrentTheme: vi.fn(),
      });

      render(<MasterLayout>child</MasterLayout>);

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("tidak ada class 'dark' saat currentTheme='light'", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        currentTheme: "light",
        setCurrentTheme: vi.fn(),
      });

      render(<MasterLayout>child</MasterLayout>);

      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("efek tema: listener matchMedia utk theme='system'", () => {
    it("memanggil setCurrentTheme('dark') saat matchMedia berubah matches=true, theme='system'", () => {
      const mql = mockMatchMedia();
      const setCurrentTheme = vi.fn();
      mockUseTheme.mockReturnValue({
        theme: "system",
        currentTheme: "light",
        setCurrentTheme,
      });

      render(<MasterLayout>child</MasterLayout>);
      mql.trigger(true);

      expect(setCurrentTheme).toHaveBeenCalledWith("dark");
    });

    it("memanggil setCurrentTheme('light') saat matchMedia berubah matches=false, theme='system'", () => {
      const mql = mockMatchMedia();
      const setCurrentTheme = vi.fn();
      mockUseTheme.mockReturnValue({
        theme: "system",
        currentTheme: "dark",
        setCurrentTheme,
      });

      render(<MasterLayout>child</MasterLayout>);
      mql.trigger(false);

      expect(setCurrentTheme).toHaveBeenCalledWith("light");
    });

    it("tidak memanggil setCurrentTheme saat theme bukan 'system'", () => {
      const mql = mockMatchMedia();
      const setCurrentTheme = vi.fn();
      mockUseTheme.mockReturnValue({
        theme: "dark",
        currentTheme: "dark",
        setCurrentTheme,
      });

      render(<MasterLayout>child</MasterLayout>);
      mql.trigger(true);

      expect(setCurrentTheme).not.toHaveBeenCalled();
    });

    it("melepas listener matchMedia saat unmount", () => {
      const mql = mockMatchMedia();
      mockUseTheme.mockReturnValue({
        theme: "system",
        currentTheme: "light",
        setCurrentTheme: vi.fn(),
      });

      const { unmount } = render(<MasterLayout>child</MasterLayout>);
      unmount();

      expect(mql.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("pencegahan context menu & shortcut devtools (debug=false)", () => {
    beforeEach(() => {
      setPage({ debug: false });
    });

    it("mencegah context menu (klik kanan)", () => {
      render(<MasterLayout>child</MasterLayout>);

      const notCanceled = fireContextMenu();
      expect(notCanceled).toBe(false);
    });

    it("mencegah tombol F12", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "F12" })).toBe(false);
    });

    it("mencegah Ctrl+Shift+I", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "I", ctrlKey: true, shiftKey: true })).toBe(
        false,
      );
    });

    it("mencegah Ctrl+Shift+C", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "C", ctrlKey: true, shiftKey: true })).toBe(
        false,
      );
    });

    it("mencegah Ctrl+Shift+J", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "J", ctrlKey: true, shiftKey: true })).toBe(
        false,
      );
    });

    it("tidak mencegah keydown biasa yang bukan shortcut apapun", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "a" })).toBe(true);
    });

    it("melepas listener contextmenu & keydown saat unmount (event tidak lagi dicegah)", () => {
      const { unmount } = render(<MasterLayout>child</MasterLayout>);
      unmount();

      expect(fireContextMenu()).toBe(true);
      expect(fireKeyDown({ key: "F12" })).toBe(true);
    });

    // BUG (lihat bugFindings): kondisi `e.ctrlKey && e.key == "U"` di
    // MasterLayout.jsx L174 dibandingkan dengan huruf kapital "U". Keydown
    // Ctrl+U asli dari keyboard menghasilkan e.key huruf kecil "u" (Ctrl saja
    // tidak mengubah casing seperti Shift), sehingga shortcut "view source"
    // yang sebenarnya ingin diblokir TIDAK pernah tercegah pada penggunaan
    // nyata. Test ini meng-assert PERILAKU SAAT INI (bukan yang seharusnya).
    it("BUG: Ctrl+U asli (key huruf kecil 'u') TIDAK tercegah walau ini shortcut yang seharusnya diblokir", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "u", ctrlKey: true })).toBe(true);
    });

    it("BUG: Ctrl+U hanya tercegah kalau key huruf besar 'U' persis seperti yang ditulis di kode (bukan kondisi keyboard nyata)", () => {
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "U", ctrlKey: true })).toBe(false);
    });
  });

  describe("context menu & shortcut devtools TIDAK dicegah saat debug=true", () => {
    it("tidak mencegah context menu saat debug=true", () => {
      setPage({ debug: true });
      render(<MasterLayout>child</MasterLayout>);

      expect(fireContextMenu()).toBe(true);
    });

    it("tidak mencegah F12 saat debug=true", () => {
      setPage({ debug: true });
      render(<MasterLayout>child</MasterLayout>);

      expect(fireKeyDown({ key: "F12" })).toBe(true);
    });
  });

  describe("AlertDialogs: alert form dirty (leave)", () => {
    it("tidak menampilkan dialog saat showAlert=false", () => {
      setDirtyFormStore({ showAlert: false });
      render(<MasterLayout>child</MasterLayout>);

      expect(
        screen.queryByText("core.form.leave.title"),
      ).not.toBeInTheDocument();
    });

    it("menampilkan title & description saat showAlert=true", () => {
      setDirtyFormStore({ showAlert: true });
      render(<MasterLayout>child</MasterLayout>);

      expect(screen.getByText("core.form.leave.title")).toBeInTheDocument();
      expect(screen.getByText("core.form.leave.subtitle")).toBeInTheDocument();
    });

    it("klik tombol cancel memanggil cancel() dari useIsDirtyForm", async () => {
      const user = userEvent.setup();
      const cancel = vi.fn();
      setDirtyFormStore({ showAlert: true, cancel });
      render(<MasterLayout>child</MasterLayout>);

      await user.click(
        screen.getByRole("button", { name: "core.form.leave.cancel" }),
      );

      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it("klik tombol leave memanggil leave() dari useIsDirtyForm", async () => {
      const user = userEvent.setup();
      const leave = vi.fn();
      setDirtyFormStore({ showAlert: true, leave });
      render(<MasterLayout>child</MasterLayout>);

      await user.click(
        screen.getByRole("button", { name: "core.form.leave.leave" }),
      );

      expect(leave).toHaveBeenCalledTimes(1);
    });

    it("klik tombol save as draft memanggil saveAsDraft() dari useIsDirtyForm", async () => {
      const user = userEvent.setup();
      const saveAsDraft = vi.fn();
      setDirtyFormStore({ showAlert: true, saveAsDraft });
      render(<MasterLayout>child</MasterLayout>);

      await user.click(
        screen.getByRole("button", {
          name: "core.form.leave.save_as_draft",
        }),
      );

      expect(saveAsDraft).toHaveBeenCalledTimes(1);
    });
  });

  describe("AlertDialogs: alert draft belum selesai (unfinished)", () => {
    it("tidak menampilkan dialog saat showAlert=false", () => {
      setDraftFormStore({ showAlert: false });
      render(<MasterLayout>child</MasterLayout>);

      expect(
        screen.queryByText("core.form.unfinished.title"),
      ).not.toBeInTheDocument();
    });

    it("menampilkan title & description saat showAlert=true", () => {
      setDraftFormStore({ showAlert: true });
      render(<MasterLayout>child</MasterLayout>);

      expect(
        screen.getByText("core.form.unfinished.title"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("core.form.unfinished.subtitle"),
      ).toBeInTheDocument();
    });

    it("klik tombol ignore memanggil cancel() dari useAlertDraftForm", async () => {
      const user = userEvent.setup();
      const cancel = vi.fn();
      setDraftFormStore({ showAlert: true, cancel });
      render(<MasterLayout>child</MasterLayout>);

      await user.click(
        screen.getByRole("button", { name: "core.form.unfinished.ignore" }),
      );

      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it("klik tombol continue memanggil continue() dari useAlertDraftForm", async () => {
      const user = userEvent.setup();
      const continueFn = vi.fn();
      setDraftFormStore({ showAlert: true, continue: continueFn });
      render(<MasterLayout>child</MasterLayout>);

      await user.click(
        screen.getByRole("button", {
          name: "core.form.unfinished.continue",
        }),
      );

      expect(continueFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("AlertDialogs: sinkronisasi locale & reset isDirty", () => {
    it("memanggil setLocale dengan lang dari page props", () => {
      setPage({ lang: "en" });
      render(<MasterLayout>child</MasterLayout>);

      expect(setLocaleMock).toHaveBeenCalledWith("en");
    });

    it("memanggil setLocale dengan string kosong saat lang tidak ada (undefined)", () => {
      setPage({ lang: undefined });
      render(<MasterLayout>child</MasterLayout>);

      expect(setLocaleMock).toHaveBeenCalledWith("");
    });

    it("memanggil setIsDirty(false) saat mount", () => {
      const setIsDirty = vi.fn();
      setDirtyFormStore({ setIsDirty });
      setPage({ url: "/halaman-a" });

      render(<MasterLayout>child</MasterLayout>);

      expect(setIsDirty).toHaveBeenCalledWith(false);
    });

    // BUG (lihat bugFindings): `AlertDialogs` di-declare sbg `memo(() => {...})`
    // TANPA props sama sekali. React.memo membandingkan props lama vs baru
    // (keduanya objek kosong `{}`) dan selalu menganggap sama -> AlertDialogs
    // TIDAK PERNAH re-render lagi setelah mount pertama, walau parent
    // (MasterLayout) re-render karena `usePage().url` berubah. Akibatnya efek
    // `useEffect(() => setIsDirty(false), [setIsDirty, url])` di dalam
    // AlertDialogs (yang seharusnya mereset dirty state pada setiap navigasi
    // Inertia) hanya jalan SEKALI seumur hidup komponen, bukan setiap kali url
    // berubah seperti yang tersirat dari dependency array-nya. Test ini
    // meng-assert PERILAKU SAAT INI (bukan yang seharusnya).
    it("BUG: TIDAK memanggil setIsDirty(false) lagi saat url berubah, karena AlertDialogs (memo tanpa props) tidak pernah re-render setelah mount pertama", () => {
      const setIsDirty = vi.fn();
      setDirtyFormStore({ setIsDirty });
      setPage({ url: "/halaman-a" });

      const { rerender } = render(<MasterLayout>child</MasterLayout>);
      const callsAfterMount = setIsDirty.mock.calls.length;
      expect(callsAfterMount).toBe(1);

      setPage({ url: "/halaman-b" });
      rerender(<MasterLayout>child</MasterLayout>);

      expect(setIsDirty.mock.calls.length).toBe(callsAfterMount);
    });
  });
});

// Helper dispatch event via document (dibungkus act() oleh fireEvent) --
// dipakai utk assert preventDefault() lewat return value dispatchEvent
// (false kalau event cancelable & preventDefault() dipanggil oleh salah
// satu listener, true kalau tidak).
function fireContextMenu() {
  return fireEvent.contextMenu(document);
}

function fireKeyDown({ key, ctrlKey = false, shiftKey = false } = {}) {
  return fireEvent.keyDown(document, { key, ctrlKey, shiftKey });
}
