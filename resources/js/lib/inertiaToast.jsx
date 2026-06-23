import { router } from "@inertiajs/react";
import { Loader2Icon } from "lucide-react";

import { gooeyToast as toast } from "@/lib/gooeyToast";

/**
 * Ambang waktu sebelum loading toast ditampilkan. Visit yang selesai lebih
 * cepat dari ini tidak memunculkan toast (cukup progress bar bawaan Inertia),
 * sehingga navigasi instan tidak berkedip/spam.
 */
const DELAY_MS = 350;

/**
 * Membuat translator dengan fallback: jika key tidak ditemukan
 * (laravel-react-i18n mengembalikan key itu sendiri), pakai teks fallback.
 * @param {(key: string) => string} t
 */
const makeTranslator = (t) => (key, fallback) => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const HTTP_ERROR_FALLBACK = {
  400: "Permintaan tidak valid. Silakan periksa data yang dikirim.",
  401: "Sesi Anda berakhir atau belum login. Silakan login kembali.",
  403: "Anda tidak memiliki izin untuk melakukan aksi ini.",
  404: "Data atau halaman yang diminta tidak ditemukan.",
  405: "Metode request tidak diizinkan untuk endpoint ini.",
  409: "Terjadi konflik data. Silakan muat ulang halaman dan coba lagi.",
  419: "Halaman kedaluwarsa. Silakan refresh lalu coba lagi.",
  422: "Data tidak valid. Silakan periksa kembali input Anda.",
  429: "Terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
  500: "Terjadi kesalahan server internal.",
  502: "Server upstream sedang bermasalah.",
  503: "Layanan sementara tidak tersedia.",
  504: "Waktu tunggu ke server habis.",
};
const TOAST_TYPE = {
  DEFAULT: "default",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
};

/**
 * Pesan untuk status HTTP tertentu, dengan i18n + fallback.
 * @param {number} status
 * @param {(key: string, fallback: string) => string} tf
 * @returns {string}
 */
const httpErrorMessage = (status, tf) => {
  const fallback = HTTP_ERROR_FALLBACK[status];
  if (fallback) {
    return tf(`core.errors.http.${status}`, fallback);
  }

  return tf(
    "core.errors.http.default",
    "Terjadi kesalahan saat memproses permintaan Anda.",
  );
};

/**
 * Menyusun pesan error dari payload event Inertia.
 *
 * Menangani dua bentuk kegagalan:
 * - `exception`: request gagal di level network/HTTP — punya `response.status`
 *   atau tidak sama sekali (network down).
 * - `error`: Inertia mengembalikan validation errors (umumnya 422) — payload
 *   berupa objek `errors`.
 * @param {object} detail - event.detail dari router.on('error'|'exception')
 * @param {(key: string, fallback: string) => string} tf
 * @returns {string}
 */
const extractError = (detail, tf) => {
  const status =
    detail?.exception?.response?.status ?? detail?.response?.status;

  if (typeof status === "number" && status >= 400 && status < 600) {
    return httpErrorMessage(status, tf);
  }

  // Validation errors (event 'error') — payload objek { field: message }
  const errors = detail?.errors;
  if (errors && typeof errors === "object") {
    const first = Object.values(errors).flat().filter(Boolean)[0];
    if (first) {
      return String(first);
    }
    return tf(
      "core.errors.http.422",
      "Data tidak valid. Silakan periksa kembali input Anda.",
    );
  }

  // Tidak ada status & tidak ada errors → kegagalan koneksi
  return tf(
    "core.errors.network.description",
    "Tidak dapat menghubungi server. Periksa koneksi Anda.",
  );
};

/**
 * Memasang lapisan loading toast berbasis event Inertia di atas progress bar
 * bawaan (tidak menggantikannya). Untuk SETIAP visit (termasuk navigasi GET):
 *
 * - Menjadwalkan loading toast dengan delay-threshold ~350ms.
 * - Jika visit selesai sebelum ambang, tidak ada toast (cukup progress bar).
 * - Sukses → update toast yang sama menjadi success.
 * - Gagal → update menjadi error (pesan + tombol Retry); jika belum tampil,
 *   tampilkan error toast langsung.
 *
 * Lapisan ini menjadi SATU-SATUNYA sumber toast error visit (listener
 * inertia:invalid / inertia:exception lama dihapus) agar tidak ada toast ganda.
 * @param {{ t: (key: string) => string }} deps
 * @returns {() => void} teardown
 */
export function setupInertiaToast({ t }) {
  const tf = makeTranslator(t);

  let timer = null;
  let toastId = null;
  /** @type {{ url: URL|string, method?: string }|null} */
  let lastVisit = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const reset = () => {
    clearTimer();
    toastId = null;
  };

  const retry = () => {
    if (!lastVisit) {
      return;
    }
    const url =
      typeof lastVisit.url === "string"
        ? lastVisit.url
        : (lastVisit.url?.href ?? String(lastVisit.url));
    router.visit(url, { method: lastVisit.method ?? "get" });
  };

  const onClose = (closedId) => {
    // Cegah race condition: abaikan event onClose dari toast lama yang
    // telat selesai animasinya (sudah diganti toast baru).
    if (closedId && closedId !== toastId) {
      return;
    }

    clearTimer();
    toastId = null;
  };

  /**
   * update loading toast (jika ada) lalu menampilkan toast final.
   * @param {string} type
   * @param {string} title
   * @param {object} [options]
   */
  const settle = (type, title, options = {}) => {
    clearTimer();
    const payload = [
      title,
      {
        icon: undefined,
        duration: 5000,
        onDismiss: onClose,
        onAutoClose: onClose,
        ...options,
      },
    ];
    const payloadOptions = payload[1];
    if (toastId != null) {
      toast.update(toastId, {
        title,
        type,
        icon: undefined,
        ...payloadOptions,
      });

      // Workaround: Karena toast.update tidak memperbarui duration (tetap Infinity),
      // kita membuang (dismiss) toast secara manual setelah 3 detik.
      const idToDismiss = toastId;
      setTimeout(() => {
        toast.dismiss(idToDismiss);
      }, payloadOptions.duration ?? 5000);

      toastId = null;
      return;
    }
    switch (type) {
      case TOAST_TYPE.INFO:
        return toast.info(...payload);
      case TOAST_TYPE.WARNING:
        return toast.warning(...payload);
      case TOAST_TYPE.ERROR:
        return toast.error(...payload);
      case TOAST_TYPE.SUCCESS:
        return toast.success(...payload);
      case TOAST_TYPE.DEFAULT:
      default:
        return toast(...payload);
    }
  };

  const offStart = router.on("start", (event) => {
    lastVisit = event.detail.visit;
    clearTimer();
    timer = setTimeout(() => {
      toastId = settle(TOAST_TYPE.DEFAULT, t("core.toast.loading"), {
        icon: <Loader2Icon className="size-4 animate-spin" />,
        duration: 9999999, // Workaround: ganti Infinity dengan angka besar
      });
      timer = null;
    }, DELAY_MS);
  });

  const offSuccess = router.on("success", () => {
    // Hanya tampilkan toast success bila loading toast sempat muncul, agar
    // navigasi cepat (di bawah delay-threshold) tidak memunculkan toast.
    if (toastId != null) {
      settle(TOAST_TYPE.SUCCESS, t("core.toast.success"));
    } else {
      clearTimer();
    }
  });

  const fail = (detail) => {
    const message = extractError(detail, tf);
    const action = {
      label: tf("core.toast.retry", "Coba lagi"),
      onClick: retry,
    };
    settle(TOAST_TYPE.ERROR, tf("core.toast.error", "Gagal"), {
      description: message,
      action,
    });
  };

  const offError = router.on("error", (event) => fail(event.detail));
  const offException = router.on("exception", (event) => fail(event.detail));

  // Jaring pengaman: jika visit berakhir tanpa success/error/exception
  // (mis. dibatalkan), batalkan timer & tutup loading toast agar tidak nyangkut.
  const offFinish = router.on("finish", (event) => {
    clearTimer();
    const wasCancelled =
      event.detail?.visit?.cancelled || event.detail?.visit?.interrupted;
    if (toastId != null && wasCancelled) {
      toast.dismiss(toastId);
      toastId = null;
    }
  });

  return () => {
    reset();
    offStart();
    offFinish();
    offSuccess();
    offError();
    offException();
  };
}
