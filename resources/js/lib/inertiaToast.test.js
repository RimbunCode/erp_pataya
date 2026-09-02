import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Loader2Icon } from "lucide-react";

// --- @inertiajs/react mock ---------------------------------------------
// setupInertiaToast() memanggil router.on() sekali per event
// ('start'|'success'|'error'|'exception'|'finish'). Mock ini menangkap tiap
// registrasi (event, handler, fungsi off yang dikembalikan) supaya test bisa
// memicu event Inertia secara langsung lewat handler-nya, dan memverifikasi
// teardown() melepas seluruh listener.
let routerOnRegistrations = [];
const routerOnMock = vi.fn((event, handler) => {
  const off = vi.fn();
  routerOnRegistrations.push({ event, handler, off });
  return off;
});
const routerVisitMock = vi.fn();

vi.mock("@inertiajs/react", () => ({
  router: {
    on: (...args) => routerOnMock(...args),
    visit: (...args) => routerVisitMock(...args),
  },
}));

// --- @/lib/gooeyToast mock -----------------------------------------------
// gooeyToast bukan sekadar objek dengan method -- ia juga CALLABLE sebagai
// fungsi (dipakai untuk toast tipe DEFAULT), lihat
// node_modules/goey-toast/dist/index.d.ts: `gooeyToast: ((title, options) =>
// id) & { success, error, warning, info, dismiss, update }`. Mock harus
// meniru bentuk callable+object ini agar `toast(...)` di source tidak crash.
const toastMock = vi.fn(() => "default-id");
toastMock.info = vi.fn(() => "info-id");
toastMock.warning = vi.fn(() => "warning-id");
toastMock.error = vi.fn(() => "error-id");
toastMock.success = vi.fn(() => "success-id");
toastMock.update = vi.fn();
toastMock.dismiss = vi.fn();

vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: toastMock,
}));

const { setupInertiaToast } = await import("./inertiaToast.jsx");

const getHandler = (eventName) =>
  routerOnRegistrations.find((r) => r.event === eventName)?.handler;

// t() mensimulasikan laravel-react-i18n saat key TIDAK ditemukan: library
// mengembalikan key itu sendiri. makeTranslator (privat, tak diexport) lalu
// jatuh ke fallback Indonesia setiap kali -- inilah kenapa title/description
// di bawah selalu berupa teks fallback, bukan key mentah (kecuali panggilan
// t() langsung tanpa lewat tf(), lihat offStart/offSuccess di source).
const makeT = () => vi.fn((key) => key);

describe("setupInertiaToast", () => {
  let t;
  let teardown;

  beforeEach(() => {
    vi.useFakeTimers();
    routerOnRegistrations = [];
    routerOnMock.mockClear();
    routerVisitMock.mockClear();
    toastMock.mockClear();
    toastMock.info.mockClear();
    toastMock.warning.mockClear();
    toastMock.error.mockClear();
    toastMock.success.mockClear();
    toastMock.update.mockClear();
    toastMock.dismiss.mockClear();

    t = makeT();
    teardown = setupInertiaToast({ t });
  });

  afterEach(() => {
    teardown?.();
    vi.useRealTimers();
  });

  it("mendaftarkan listener untuk start/success/error/exception/finish", () => {
    expect(routerOnRegistrations.map((r) => r.event)).toEqual([
      "start",
      "success",
      "error",
      "exception",
      "finish",
    ]);
  });

  describe("loading toast delay-threshold (DELAY_MS = 350ms)", () => {
    it("tidak menampilkan toast apa pun sebelum 350ms terlewati", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(349);

      expect(toastMock).not.toHaveBeenCalled();
    });

    it("menampilkan loading toast tepat setelah 350ms dengan icon spinner", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);

      expect(toastMock).toHaveBeenCalledTimes(1);
      const [title, options] = toastMock.mock.calls[0];
      expect(title).toBe("core.toast.loading");
      expect(options.duration).toBe(9999999);
      expect(options.icon.type).toBe(Loader2Icon);
      expect(options.icon.props.className).toBe("size-4 animate-spin");
    });

    it("visit yang selesai (success) sebelum 350ms tidak pernah memunculkan toast", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      getHandler("success")({ detail: {} });

      // timer sudah dibatalkan oleh handler success (toastId masih null) --
      // majukan waktu melewati ambang, toast loading tetap tidak muncul.
      vi.advanceTimersByTime(1000);
      expect(toastMock).not.toHaveBeenCalled();
      expect(toastMock.success).not.toHaveBeenCalled();
    });
  });

  describe("success", () => {
    it("mengubah loading toast yang sudah tampil menjadi success (update, bukan toast baru)", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);

      getHandler("success")({ detail: {} });

      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.update).toHaveBeenCalledTimes(1);
      const [id, updatePayload] = toastMock.update.mock.calls[0];
      expect(id).toBe("default-id");
      expect(updatePayload.title).toBe("core.toast.success");
      expect(updatePayload.type).toBe("success");
    });

    it("workaround: membuang toast update secara manual setelah durasi berlalu (toast.update tak reset duration)", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);
      getHandler("success")({ detail: {} });

      expect(toastMock.dismiss).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(toastMock.dismiss).toHaveBeenCalledWith("default-id");
    });
  });

  describe("error (validation, event 'error')", () => {
    it("menampilkan error toast dari pesan error pertama, TANPA tombol retry", () => {
      getHandler("error")({
        detail: { errors: { name: ["Nama wajib diisi"] } },
      });

      expect(toastMock.error).toHaveBeenCalledTimes(1);
      const [title, options] = toastMock.error.mock.calls[0];
      expect(title).toBe("Gagal");
      expect(options.description).toBe("Nama wajib diisi");
      expect(options.action).toBeUndefined();
    });

    it("errors yang semua valuenya falsy (string kosong) jatuh ke fallback pesan 422", () => {
      getHandler("error")({ detail: { errors: { name: [""] } } });

      const [, options] = toastMock.error.mock.calls[0];
      expect(options.description).toBe(
        "Data tidak valid. Silakan periksa kembali input Anda.",
      );
    });

    it("mengabaikan event error kedua dgn signature errors identik (carry-over reload deferred-props)", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      getHandler("error")({ detail: { errors: { a: ["x"] } } });
      expect(toastMock.error).toHaveBeenCalledTimes(1);

      // Signature sama persis -> dianggap carry-over dari reload deferred
      // props, bukan submit baru -> tidak toast lagi.
      getHandler("error")({ detail: { errors: { a: ["x"] } } });
      expect(toastMock.error).toHaveBeenCalledTimes(1);

      // Errors BEDA -> signature beda -> toast lagi.
      getHandler("error")({ detail: { errors: { b: ["y"] } } });
      expect(toastMock.error).toHaveBeenCalledTimes(2);
    });

    it("start dengan deferredProps TIDAK mereset shownErrorSignature", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      getHandler("error")({ detail: { errors: { a: ["x"] } } });
      expect(toastMock.error).toHaveBeenCalledTimes(1);

      // Reload deferred-props: visit baru, tapi deferredProps=true -> tidak
      // mereset signature lama.
      getHandler("start")({
        detail: { visit: { url: "/foo", deferredProps: true } },
      });
      getHandler("error")({ detail: { errors: { a: ["x"] } } });
      expect(toastMock.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("exception (network/HTTP, event 'exception')", () => {
    it("memetakan status HTTP yang dikenal (404) ke pesan fallback-nya", () => {
      getHandler("exception")({
        detail: { exception: { response: { status: 404 } } },
      });

      const [, options] = toastMock.error.mock.calls[0];
      expect(options.description).toBe(
        "Data atau halaman yang diminta tidak ditemukan.",
      );
    });

    it("status HTTP yang tidak dipetakan memakai pesan default", () => {
      getHandler("exception")({
        detail: { exception: { response: { status: 418 } } },
      });

      const [, options] = toastMock.error.mock.calls[0];
      expect(options.description).toBe(
        "Terjadi kesalahan saat memproses permintaan Anda.",
      );
    });

    it("tanpa status & tanpa errors dianggap kegagalan koneksi", () => {
      getHandler("exception")({ detail: {} });

      const [, options] = toastMock.error.mock.calls[0];
      expect(options.description).toBe(
        "Tidak dapat menghubungi server. Periksa koneksi Anda.",
      );
    });

    it("menyertakan tombol retry (berbeda dari event 'error' validasi)", () => {
      getHandler("exception")({ detail: { response: { status: 500 } } });

      const [, options] = toastMock.error.mock.calls[0];
      expect(options.action.label).toBe("Coba lagi");
      expect(typeof options.action.onClick).toBe("function");
    });
  });

  describe("retry", () => {
    it("memanggil router.visit ke url & method visit terakhir", () => {
      getHandler("start")({
        detail: { visit: { url: "/orders/1", method: "post" } },
      });
      getHandler("exception")({ detail: { response: { status: 500 } } });

      const [, options] = toastMock.error.mock.calls[0];
      options.action.onClick();

      expect(routerVisitMock).toHaveBeenCalledWith("/orders/1", {
        method: "post",
      });
    });

    it("fallback method ke 'get' & memakai .href bila url berupa object URL", () => {
      getHandler("start")({
        detail: {
          visit: {
            url: new URL("https://example.test/bar"),
            method: undefined,
          },
        },
      });
      getHandler("exception")({ detail: { response: { status: 500 } } });

      const [, options] = toastMock.error.mock.calls[0];
      options.action.onClick();

      expect(routerVisitMock).toHaveBeenCalledWith("https://example.test/bar", {
        method: "get",
      });
    });

    it("tidak melakukan apa pun jika belum pernah ada visit ('start' belum pernah terjadi)", () => {
      getHandler("exception")({ detail: { response: { status: 500 } } });

      const [, options] = toastMock.error.mock.calls[0];
      options.action.onClick();

      expect(routerVisitMock).not.toHaveBeenCalled();
    });
  });

  describe("onClose (onDismiss/onAutoClose) — guard race condition", () => {
    it("mengabaikan id toast lama yang tidak cocok dgn toastId aktif saat ini", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);
      const [, loadingOptions] = toastMock.mock.calls[0];

      // Simulasikan animasi close toast LAMA yang telat selesai.
      loadingOptions.onDismiss("stale-id-lama");

      // toastId aktif TIDAK direset -> success masih meng-update toast aktif.
      getHandler("success")({ detail: {} });
      expect(toastMock.update).toHaveBeenCalledWith(
        "default-id",
        expect.objectContaining({ type: "success" }),
      );
    });

    it("mereset toastId saat id yang ditutup cocok dengan toastId aktif", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);
      const [, loadingOptions] = toastMock.mock.calls[0];

      loadingOptions.onDismiss("default-id");

      // toastId sudah null -> success tidak melakukan apa pun lagi.
      getHandler("success")({ detail: {} });
      expect(toastMock.update).not.toHaveBeenCalled();
      expect(toastMock.success).not.toHaveBeenCalled();
    });
  });

  describe("finish (jaring pengaman)", () => {
    it("membatalkan timer loading yang masih pending saat visit selesai cepat", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      getHandler("finish")({ detail: { visit: {} } });

      vi.advanceTimersByTime(1000);
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("menutup paksa loading toast yang masih tampil saat visit dibatalkan (cancelled)", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);

      getHandler("finish")({ detail: { visit: { cancelled: true } } });
      expect(toastMock.dismiss).toHaveBeenCalledWith("default-id");
    });

    it("menutup paksa loading toast saat visit diinterupsi (interrupted)", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);

      getHandler("finish")({ detail: { visit: { interrupted: true } } });
      expect(toastMock.dismiss).toHaveBeenCalledWith("default-id");
    });

    it("TIDAK menutup toast jika visit selesai normal (bukan cancelled/interrupted)", () => {
      getHandler("start")({ detail: { visit: { url: "/foo" } } });
      vi.advanceTimersByTime(350);

      getHandler("finish")({ detail: { visit: {} } });
      expect(toastMock.dismiss).not.toHaveBeenCalled();
    });
  });

  describe("teardown", () => {
    it("melepas seluruh listener router.on yang didaftarkan saat setup", () => {
      const offs = routerOnRegistrations.map((r) => r.off);
      expect(offs).toHaveLength(5);

      teardown();
      offs.forEach((off) => expect(off).toHaveBeenCalledTimes(1));
    });
  });
});
