import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, mergeRefs } from "@/lib/utils";
import { formatNumber, formatTyping, normalizeSign } from "./formatNumber";

import { cleanNumber } from "./cleanNumber";
import { parseNumberFormat } from "./parseNumberFormat";
import { resolveCurrencyInput, useCurrency } from "./useCurrency";
import { fetchExchangeRate } from "./fetchExchangeRate";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export { formatNumber, formatTyping, normalizeSign } from "./formatNumber";
export { parseNumberFormat } from "./parseNumberFormat";
export { cleanNumber } from "./cleanNumber";
export { getCurrencyConfig } from "./getCurrencyConfig";
export { fetchExchangeRate } from "./fetchExchangeRate";

const DEFAULT_CLASSNAME =
  "text-right flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const toFloatOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Normalisasi prop `value`: terima number/string, dan secara defensif menerima
 * object payload `{ float }` (mis. dari state yang salah dipakai sebelumnya).
 * @param {number|string|{float:number|null}|null|undefined} value
 * @returns {number|string|null|undefined}
 */
const normalizeValue = (value) => {
  if (value !== null && typeof value === "object") {
    return value.float ?? null;
  }
  return value;
};

/**
 * Hitung jumlah digit (0-9) pada `str` sebelum indeks `pos`.
 * Dipakai sebagai anchor stabil untuk reposisi kursor saat grouping berubah.
 * @param {string} str
 * @param {number} pos
 * @returns {number}
 */
const countDigitsBefore = (str, pos) => {
  let count = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (str[i] >= "0" && str[i] <= "9") count++;
  }
  return count;
};

/**
 * Cari indeks pada `str` tepat setelah digit ke-`n` (1-based).
 * Kebalikan dari countDigitsBefore untuk memulihkan posisi kursor.
 * @param {string} str
 * @param {number} n
 * @returns {number}
 */
const indexAfterNthDigit = (str, n) => {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] >= "0" && str[i] <= "9") {
      count++;
      if (count === n) return i + 1;
    }
  }
  return str.length;
};

/**
 * True jika karakter `ch` adalah "signifikan" untuk anchor kursor:
 * digit ATAU decimalSeparator. Tanda minus, separator ribuan, prefix, dan
 * suffix TIDAK signifikan karena posisinya bisa bergeser/ditambahkan otomatis
 * (minus selalu dipindah ke depan, sehingga tidak menggeser posisi digit).
 * @param {string} ch
 * @param {string} decimalSeparator
 * @returns {boolean}
 */
const isAnchorChar = (ch, decimalSeparator) =>
  (ch >= "0" && ch <= "9") || ch === decimalSeparator;

/**
 * Hitung jumlah karakter signifikan (digit + decimalSeparator) pada `str`
 * sebelum indeks `pos`.
 * @param {string} str
 * @param {number} pos
 * @param {string} decimalSeparator
 * @returns {number}
 */
const countAnchorBefore = (str, pos, decimalSeparator) => {
  let count = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (isAnchorChar(str[i], decimalSeparator)) count++;
  }
  return count;
};

/**
 * Hitung total karakter signifikan pada `str`.
 * @param {string} str
 * @param {string} decimalSeparator
 * @returns {number}
 */
const countAnchorTotal = (str, decimalSeparator) =>
  countAnchorBefore(str, str.length, decimalSeparator);

/**
 * Cari posisi kursor pada `formatted` setelah karakter signifikan ke-`n`,
 * dimulai SETELAH lead region (prefix + tanda minus). Bila `n` melebihi jumlah
 * anchor yang tersedia (mis. leading zero di-strip), kursor di-clamp ke anchor
 * terakhir; bila `n` 0, kursor ditempatkan tepat setelah lead region.
 * @param {string} formatted hasil format yang ditampilkan
 * @param {number} n urutan anchor (1-based) hasil countAnchorBefore
 * @param {string} decimalSeparator
 * @param {number} leadLen panjang prefix + minus pada formatted
 * @returns {number}
 */
const caretAfterNthAnchor = (formatted, n, decimalSeparator, leadLen) => {
  if (n <= 0) return leadLen;
  let count = 0;
  for (let i = leadLen; i < formatted.length; i++) {
    if (isAnchorChar(formatted[i], decimalSeparator)) {
      count++;
      if (count === n) return i + 1;
    }
  }
  // n melebihi anchor tersedia: tempatkan setelah anchor terakhir (sebelum suffix).
  let lastAnchor = leadLen;
  for (let i = leadLen; i < formatted.length; i++) {
    if (isAnchorChar(formatted[i], decimalSeparator)) lastAnchor = i + 1;
  }
  return lastAnchor;
};

/**
 * Hitung jumlah digit (0-9) pada string. Dipakai untuk menegakkan maxLength
 * berbasis digit (separator/prefix/suffix/tanda/desimal tidak dihitung).
 * @param {string} str
 * @returns {number}
 */
const countDigits = (str) => {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] >= "0" && str[i] <= "9") count++;
  }
  return count;
};

/**
 * Detail nilai yang dikirim sebagai argumen kedua `onValueChange`.
 * @typedef {object} NumberInputValues
 * @property {number|null} float nilai numerik (null jika kosong)
 * @property {string} formatted string terformat yang tampil
 * @property {string} value string angka mentah
 */

/**
 * Callback perubahan nilai. Dipanggil dengan dua argumen: `float` untuk
 * pemakaian cepat (kompatibel handler scalar), dan object detail lengkap.
 * @callback NumberInputOnValueChange
 * @param {number|null} float nilai numerik (null jika kosong)
 * @param {NumberInputValues} values detail `{ float, formatted, value }`
 * @returns {void}
 */

/**
 * Input angka/currency (clone fresh dari CurrencyInput) dengan perilaku
 * format-on-blur. Group separator diterapkan realtime saat mengetik, sedangkan
 * pembulatan `decimalScale` ditunda hingga `onBlur`. Konfigurasi format dasar
 * bersumber dari preference `default_number_format` dan dapat di-override
 * per prop. Dibungkus `forwardRef`; prop input HTML standar yang tidak dikenal
 * diteruskan ke elemen `<input>`.
 *
 * Precedence konfigurasi: `numberFormat` > prop individual (`groupSeparator` /
 * `decimalSeparator` / `decimalScale`) > `default_number_format`. Prop
 * `currencyCode` hanya menarik symbol currency sebagai `prefix` (tidak mengubah
 * separator/scale), dengan cache di localStorage.
 * @param {object} props
 * @param {string} [props.className] kelas tambahan, digabung dengan style default via `cn`
 * @param {number|string|null} [props.value] nilai terkontrol dari parent (float)
 * @param {NumberInputOnValueChange} [props.onValueChange] callback saat nilai berubah
 * @param {boolean} [props.allowDecimals] izinkan desimal; bila `false`, decimalScale dipaksa 0; default `true`
 * @param {boolean} [props.allowNegativeValue] izinkan nilai negatif; default `true`
 * @param {string} [props.groupSeparator] override pemisah ribuan
 * @param {string} [props.decimalSeparator] override pemisah desimal
 * @param {number} [props.decimalScale] override jumlah desimal (pembulatan saat onBlur)
 * @param {string} [props.numberFormat] pola `#,###.##`; bila di-set, override grp/dec/scale
 * @param {number} [props.min] saat onBlur, nilai di bawah ini di-clamp ke `min`
 * @param {number} [props.max] saat onBlur, nilai di atas ini di-clamp ke `max`
 * @param {number|null} [props.maxLength] batas jumlah DIGIT (integer + desimal, tanpa separator/tanda); default `12`; `null` menonaktifkan
 * @param {string} [props.prefix] teks di depan; menang atas symbol currency
 * @param {string} [props.suffix] teks di belakang
 * @param {"default"|string} [props.currencyCode] kode currency untuk menarik symbol; `"default"` memakai preference default
 * @param {boolean} [props.enableExchangeRate] aktifkan fetch exchange rate otomatis dari Frankfurter API; default `false`
 * @param {(result: { rate: number, base: string, quote: string, date: string } | null) => void} [props.onExchangeRate] callback hasil exchange rate; `null` bila currency sama
 * @param {import('react').Ref<HTMLInputElement>} ref ref yang diteruskan ke elemen `<input>`
 * @returns {import('react').ReactElement}
 * @example
 * // Pemakaian dasar (handler scalar — baca argumen pertama / float):
 * <NumberInput value={amount} onValueChange={setAmount} />
 *
 * // Dengan currency symbol + override scale:
 * <NumberInput currencyCode="USD" decimalScale={2} value={price} onValueChange={setPrice} />
 *
 * // Akses detail lengkap:
 * <NumberInput onValueChange={(float, { formatted, value }) => ...} />
 */
export default forwardRef(function NumberInput(
  {
    className,
    value: rawValue,
    onValueChange,
    allowDecimals = true,
    allowNegativeValue = true,
    groupSeparator,
    decimalSeparator,
    decimalScale,
    numberFormat,
    min,
    max,
    maxLength = 12,
    prefix,
    suffix,
    currencyCode,
    enableExchangeRate = false,
    onExchangeRate,
    ...props
  },
  ref,
) {
  const { preferences } = usePage().props;
  const { symbol } = useCurrency(currencyCode);
  const { t } = useLaravelReactI18n();

  // Defensif: jika parent terlanjur menyimpan object payload sebagai value.
  const value = normalizeValue(rawValue);

  // Resolusi konfigurasi format: base default_number_format -> override prop.
  const config = useMemo(() => {
    const base = parseNumberFormat(
      numberFormat || preferences?.default_number_format,
    );

    const resolved = {
      groupSeparator: groupSeparator ?? base.groupSeparator,
      decimalSeparator: decimalSeparator ?? base.decimalSeparator,
      decimalScale: decimalScale ?? base.decimalScale,
      allowNegativeValue,
    };

    if (!allowDecimals) {
      resolved.decimalScale = 0;
    }

    // currencyCode hanya menyumbang symbol (prefix), bukan separator/scale.
    // Prop prefix eksplisit selalu menang atas symbol currency.
    if (prefix !== undefined && prefix !== null) {
      resolved.prefix = prefix;
    } else if (currencyCode) {
      resolved.prefix = symbol ?? "";
    } else {
      resolved.prefix = "";
    }
    resolved.suffix = suffix ?? "";

    return resolved;
  }, [
    numberFormat,
    preferences?.default_number_format,
    groupSeparator,
    decimalSeparator,
    decimalScale,
    allowDecimals,
    allowNegativeValue,
    prefix,
    suffix,
    currencyCode,
    symbol,
  ]);

  const inputRef = useRef(null);
  const prevValueRef = useRef(value);
  // Posisi kursor yang harus dipulihkan setelah render (saat mengetik). null
  // berarti tidak perlu memindah kursor (mis. update dari parent/blur).
  const pendingCaretRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(() =>
    value === null || value === undefined || Number.isNaN(value)
      ? ""
      : formatNumber(value, config),
  );

  // Pulihkan posisi kursor secara sinkron SETELAH DOM diperbarui namun SEBELUM
  // paint. Memakai useLayoutEffect (bukan requestAnimationFrame) menghindari
  // race saat mengetik cepat: setiap render menempatkan kursor pada posisi yang
  // dihitung untuk render tersebut, tidak tertinggal frame sebelumnya.
  useLayoutEffect(() => {
    if (pendingCaretRef.current === null) return;
    const pos = pendingCaretRef.current;
    pendingCaretRef.current = null;
    if (inputRef.current) {
      inputRef.current.setSelectionRange(pos, pos);
    }
  });

  // Sinkronisasi saat parent mengubah value.
  useDidMountEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    if (value === null || value === undefined || Number.isNaN(value)) {
      setDisplayValue("");
    } else {
      setDisplayValue(formatNumber(value, config));
    }
  }, [value, config]);

  // Fetch exchange rate when enableExchangeRate is truthy.
  // Menampilkan toast loading yang di-update in-place menjadi success/error
  // via toast.promise(). Tombol Retry muncul saat error.
  const doFetchExchangeRate = useCallback(() => {
    const resolution = resolveCurrencyInput(currencyCode);
    if (resolution.kind !== "fetch") return;

    const baseCode = resolution.code;
    const quoteCode = preferences?.default_currency_id;

    if (!baseCode || !quoteCode) return;

    // currencyCode "default" sama dengan default_currency_id -> skip tanpa toast.
    if (baseCode === "default" || baseCode === quoteCode) {
      onExchangeRate?.(null);
      return;
    }

    const promise = fetchExchangeRate(baseCode, { quote: quoteCode });

    toast.promise(promise, {
      loading: t("core.toast.exchange_rate.loading", {
        base: baseCode,
        quote: quoteCode,
      }),
      success: (data) => {
        onExchangeRate?.(data);
        return t("core.toast.exchange_rate.success");
      },
      error: (_err) => {
        onExchangeRate?.(null);
        return t("core.toast.exchange_rate.error");
      },
      description: {
        success: (data) =>
          t("core.toast.exchange_rate.success_desc", {
            rate: data.rate,
            base: data.base,
            quote: data.quote,
          }),
        error: (err) =>
          t("core.toast.exchange_rate.error_desc", { message: err.message }),
      },
      action: {
        error: {
          label: t("core.toast.retry"),
          onClick: doFetchExchangeRate,
        },
      },
    });
  }, [currencyCode, preferences?.default_currency_id, onExchangeRate, t]);

  useEffect(() => {
    if (!enableExchangeRate) return;
    doFetchExchangeRate();
  }, [enableExchangeRate, doFetchExchangeRate]);

  const emit = (raw, formatted) => {
    if (!onValueChange) return;
    const float = toFloatOrNull(raw);
    prevValueRef.current = float;
    // Param 1: float untuk pemakaian cepat. Param 2: detail lengkap.
    onValueChange(float, { float, formatted, value: raw });
  };

  const handleChange = (e) => {
    const el = e.target;
    const input = el.value;
    const caret = el.selectionStart ?? input.length;

    // Sanitasi karakter: digit, decimalSeparator, dan minus (jika diizinkan).
    const sep = config.decimalSeparator;
    let allowed = `0-9\\${sep}`;
    if (allowNegativeValue) allowed += "\\-";
    let sanitized = input.replace(new RegExp(`[^${allowed}]`, "g"), "");

    // Normalisasi minus: hanya boleh satu dan di posisi paling depan.
    // Mengetik "-" di tengah (mis. "12-3", "5-") tetap berarti nilai negatif.
    sanitized = normalizeSign(sanitized, allowNegativeValue);

    // decimalSeparator hanya boleh satu. Jika user mengetik separator baru
    // (tepat sebelum caret) padahal sudah ada, separator BERPINDAH ke posisi
    // baru: buang semua separator lalu sisipkan ulang setelah jumlah digit yang
    // ada sebelum caret. Selain itu (mis. paste) pertahankan separator pertama.
    // anchorOverride: bila >=0, dipakai sebagai jumlah anchor sebelum kursor
    // (mengganti perhitungan generik) untuk kasus relokasi separator.
    let anchorOverride = -1;
    const sepCount = sanitized.split(sep).length - 1;
    if (sepCount > 1) {
      const typedSepAtCaret = caret > 0 && input[caret - 1] === sep;
      if (typedSepAtCaret) {
        const digitsBeforeCaret = countDigits(input.slice(0, caret));
        const digitsOnly = sanitized.replaceAll(sep, "");
        const lead = digitsOnly.startsWith("-") ? 1 : 0;
        const cut = lead + digitsBeforeCaret;
        sanitized = digitsOnly.slice(0, cut) + sep + digitsOnly.slice(cut);
        // Kursor harus tepat SETELAH separator: digit sebelum + separator itu.
        anchorOverride = digitsBeforeCaret + 1;
      } else {
        const firstSep = sanitized.indexOf(sep);
        sanitized =
          sanitized.slice(0, firstSep + 1) +
          sanitized.slice(firstSep + 1).replaceAll(sep, "");
      }
    }

    // maxLength berbasis digit (integer + desimal), tanpa separator/tanda.
    // Jika melebihi, tolak perubahan: pertahankan tampilan & kursor sebelumnya.
    if (
      maxLength !== undefined &&
      maxLength !== null &&
      countDigits(sanitized) > maxLength
    ) {
      const prevDigitsBefore = countDigitsBefore(input, caret) - 1;
      const restoreCaret = indexAfterNthDigit(displayValue, prevDigitsBefore);
      el.value = displayValue;
      // Nilai dikembalikan ke displayValue lama (DOM langsung sinkron), jadi
      // kursor bisa di-set langsung tanpa menunggu render.
      el.setSelectionRange(restoreCaret, restoreCaret);
      return;
    }

    // Format realtime langsung dari string yang diketik: group separator masuk,
    // desimal (termasuk trailing separator/nol) dipertahankan apa adanya.
    // formatTyping menerima string dgn decimalSeparator "."; konversi dulu.
    const rawTyped = sep !== "." ? sanitized.replaceAll(sep, ".") : sanitized;
    const formatted = formatTyping(rawTyped, config);

    // Raw numeric untuk float (TANPA pembulatan).
    const raw = cleanNumber(sanitized, config);

    const unchanged = formatted === displayValue;
    setDisplayValue(formatted);

    // Reposisi kursor berbasis karakter signifikan (digit + decimalSeparator);
    // prefix/suffix/grouping/minus diabaikan agar tidak menggeser anchor.
    // Minus selalu di depan, jadi masuk "lead region" bersama prefix.
    const prefixLen = config.prefix ? config.prefix.length : 0;
    const signLen = formatted[prefixLen] === "-" ? 1 : 0;
    const leadLen = prefixLen + signLen;
    let anchorBefore;

    if (anchorOverride >= 0) {
      // Relokasi separator: kursor ditempatkan tepat setelah separator baru.
      anchorBefore = anchorOverride;
    } else {
      anchorBefore = countAnchorBefore(input, caret, sep);

      // Jika leading zero di-strip, jumlah anchor di formatted berkurang dari
      // yang diketik. Kurangi anchorBefore sebanyak selisih agar kursor tidak
      // melompat melewati digit yang tersisa.
      const droppedAnchors =
        countAnchorTotal(sanitized, sep) - countAnchorTotal(formatted, sep);
      if (droppedAnchors > 0) {
        anchorBefore = Math.max(0, anchorBefore - droppedAnchors);
      }
    }

    const newCaret = caretAfterNthAnchor(formatted, anchorBefore, sep, leadLen);

    if (unchanged) {
      // Nilai display sama -> React bail-out (tak re-render), tapi DOM `el.value`
      // masih berisi karakter yang baru diketik & dibuang. Reset value ke
      // formatted dulu agar panjang string benar, baru set kursor (sinkron).
      el.value = formatted;
      el.setSelectionRange(newCaret, newCaret);
    } else {
      // Simpan target kursor; dipulihkan di useLayoutEffect setelah render agar
      // tahan terhadap race saat mengetik cepat.
      pendingCaretRef.current = newCaret;
    }

    // Saat typing: kirim float mentah (pembulatan ditunda ke onBlur).
    emit(raw, formatted);
  };

  const handleBlur = (e) => {
    const raw = cleanNumber(displayValue, config);
    let float = toFloatOrNull(raw);

    if (float === null) {
      setDisplayValue("");
      emit("", "");
      props.onBlur?.(e);
      return;
    }

    // Clamp min/max.
    if (min !== undefined && min !== null && float < min) float = min;
    if (max !== undefined && max !== null && float > max) float = max;

    // onBlur: format penuh termasuk pembulatan decimalScale (round half-up).
    const formatted = formatNumber(float, config);
    setDisplayValue(formatted);
    emit(String(float), formatted);

    props.onBlur?.(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.target.blur();
    }

    // Lompati group separator saat menghapus: tanpa ini, Backspace/Delete
    // menghapus separator yang langsung disisipkan ulang oleh grouping,
    // sehingga terasa "tidak bisa menghapus". Geser kursor melewati separator
    // agar yang terhapus adalah digit di sebelahnya.
    const grp = config.groupSeparator;
    if (grp && (e.key === "Backspace" || e.key === "Delete")) {
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === end) {
        if (e.key === "Backspace" && start > 0 && el.value[start - 1] === grp) {
          el.setSelectionRange(start - 1, start - 1);
        } else if (
          e.key === "Delete" &&
          start < el.value.length &&
          el.value[start] === grp
        ) {
          el.setSelectionRange(start + 1, start + 1);
        }
      }
    }

    props.onKeyDown?.(e);
  };

  const { onBlur: _onBlur, onKeyDown: _onKeyDown, ...rest } = props;

  // Placeholder default: hasil format nilai saat ini (atau 0 bila kosong).
  const defaultPlaceholder = formatNumber(value ?? 0, config);

  return (
    <input
      ref={mergeRefs(inputRef, ref)}
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={defaultPlaceholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(DEFAULT_CLASSNAME, className)}
      {...rest}
    />
  );
});
