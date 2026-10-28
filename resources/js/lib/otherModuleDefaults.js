import { useRef } from "react";

export const EMPTY_OTHER_DEFAULTS = Object.freeze({});

const DEPRECIATION_FIELDS = [
  "depreciation_method",
  "frequency_of_depreciation",
  "total_number_of_depreciations",
];

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function timeOf(value) {
  if (isBlank(value)) return null;
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

/**
 * Tanggal `value` ditambah `days` hari kalender.
 * @param {Date|string|number|null|undefined} value tanggal dasar
 * @param {number|string|null|undefined} days jumlah hari yang ditambahkan
 * @returns {Date|null} null bila salah satunya tidak valid
 */
export function addDays(value, days) {
  const time = timeOf(value);
  if (time === null || isBlank(days) || Number.isNaN(Number(days))) {
    return null;
  }
  const next = new Date(time);
  next.setDate(next.getDate() + Number(days));

  return next;
}

/**
 * Field depresiasi yang masih kosong dan punya default; tidak pernah menimpa nilai yang ada.
 * @param {object|undefined} data data form saat ini
 * @param {object|undefined} defaults default dari setting Asset
 * @returns {object} field yang perlu diisi
 */
export function depreciationDefaultsPatch(data, defaults) {
  const patch = {};
  for (const field of DEPRECIATION_FIELDS) {
    if (isBlank(data?.[field]) && !isBlank(defaults?.[field])) {
      patch[field] = defaults[field];
    }
  }

  return patch;
}

/**
 * Tanggal target = tanggal sumber + N hari pada dokumen baru. Nilai awal ikut default form
 * (`initialPatch`) dan berikutnya mengikuti perubahan sumber (`followPatch`) selama target belum
 * disentuh. Sengaja tanpa efek yang memanggil setData saat mount: itu berbarengan dengan
 * penerapan default `useFormPage` dan menghapus default lain (mis. jenis dan tanggal Quotation).
 *
 * Nilai target yang bukan hasil pengisian otomatis (ketikan user atau draft yang dipulihkan)
 * dianggap disentuh dan tidak pernah ditimpa; `markTouched` dipanggil saat user mengubah target.
 * @param {number|string|null|undefined} days jumlah hari dari setting; kosong = tidak aktif.
 * @returns {{initialPatch: (source: unknown, field: string) => object, followPatch: (source: unknown, current: unknown, field: string) => object, markTouched: () => void}} pengendali
 */
export function useFollowingDate(days) {
  const touchedRef = useRef(false);
  const lastAutoTimeRef = useRef(null);
  const active = !isBlank(days);

  const auto = (source) => {
    const next = active ? addDays(source, days) : null;
    if (next !== null) lastAutoTimeRef.current = next.getTime();

    return next;
  };

  return {
    /**
     * Objek `{[field]: tanggal}` untuk default form baru, atau `{}` bila tidak berlaku.
     * @param {Date|string|number|null|undefined} source tanggal sumber
     * @param {string} field nama field target
     * @returns {object} patch untuk digabung ke default form
     */
    initialPatch: (source, field) => {
      const next = auto(source);

      return next === null ? {} : { [field]: next };
    },
    /**
     * Objek `{[field]: tanggal}` untuk digabung ke data saat sumber diubah user, atau `{}`.
     * @param {Date|string|number|null|undefined} source tanggal sumber yang baru
     * @param {Date|string|number|null|undefined} current nilai target saat ini
     * @param {string} field nama field target
     * @returns {object} patch untuk digabung ke data form
     */
    followPatch: (source, current, field) => {
      if (!active || touchedRef.current) return {};
      const currentTime = timeOf(current);
      if (currentTime !== null && currentTime !== lastAutoTimeRef.current) {
        touchedRef.current = true;

        return {};
      }
      const next = auto(source);

      return next === null ? {} : { [field]: next };
    },
    markTouched: () => {
      touchedRef.current = true;
    },
  };
}
