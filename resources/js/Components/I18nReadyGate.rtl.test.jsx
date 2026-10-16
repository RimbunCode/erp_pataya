import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";

import I18nReadyGate, {
  I18N_READY_TIMEOUT_MS,
  areI18nFilesEager,
} from "./I18nReadyGate";
import {
  LaravelReactI18nProvider,
  useLaravelReactI18n,
} from "laravel-react-i18n";

// Regresi: `import.meta.glob("/lang/*.json")` tanpa `eager` membuat provider
// memuat lang secara asinkron, dan sampai selesai `t(key)` mengembalikan key
// apa adanya. Test ini memakai provider ASLI (bukan mock) supaya perilaku itu
// benar-benar terjadi. Cache terjemahan provider bersifat module-level, jadi
// tiap test memakai kode locale unik.

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Anak yang mencatat setiap hasil `t()` saat render, meniru nilai yang dihitung
 * sekali lalu dibekukan di luar React (label tabel GrapesJS).
 * @param {object} props
 * @param {string[]} props.seen Penampung hasil render.
 * @returns {import("react").JSX.Element}
 */
function Probe({ seen }) {
  const { t } = useLaravelReactI18n();
  const label = t("table.col");
  seen.push(label);
  return <span data-testid="label">{label}</span>;
}

function renderApp({ files, locale, withGate, seen }) {
  return render(
    <LaravelReactI18nProvider
      locale={locale}
      fallbackLocale={locale}
      files={files}
    >
      {withGate ? (
        <I18nReadyGate files={files}>
          <Probe seen={seen} />
        </I18nReadyGate>
      ) : (
        <Probe seen={seen} />
      )}
    </LaravelReactI18nProvider>,
  );
}

describe("I18nReadyGate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("kontrol: tanpa gerbang, anak sempat merender key mentah", async () => {
    const gate = deferred();
    const seen = [];
    renderApp({
      locale: "xa",
      withGate: false,
      seen,
      files: { "/lang/php_xa.json": () => gate.promise },
    });

    await act(async () => {
      gate.resolve({ default: { "table.col": "Kolom Jadi" } });
      await gate.promise;
    });

    expect(seen[0]).toBe("table.col");
    expect(screen.getByTestId("label").textContent).toBe("Kolom Jadi");
  });

  it("dengan gerbang, anak tidak pernah merender sebelum terjemahan siap", async () => {
    const gate = deferred();
    const seen = [];
    renderApp({
      locale: "xb",
      withGate: true,
      seen,
      files: { "/lang/php_xb.json": () => gate.promise },
    });

    expect(screen.queryByTestId("label")).toBeNull();
    expect(seen).toEqual([]);

    await act(async () => {
      gate.resolve({ default: { "table.col": "Kolom Jadi" } });
      await gate.promise;
    });

    expect(screen.getByTestId("label").textContent).toBe("Kolom Jadi");
    expect(seen).not.toContain("table.col");
  });

  it("tetap merender setelah batas waktu kalau berkas lang tidak pernah selesai", async () => {
    vi.useFakeTimers();
    const seen = [];
    renderApp({
      locale: "xc",
      withGate: true,
      seen,
      files: { "/lang/php_xc.json": () => new Promise(() => {}) },
    });

    expect(screen.queryByTestId("label")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(I18N_READY_TIMEOUT_MS + 10);
    });

    expect(screen.getByTestId("label")).toBeTruthy();
  });

  it("tidak menunggu kalau berkas lang dimuat eager", () => {
    const seen = [];
    renderApp({
      locale: "xd",
      withGate: true,
      seen,
      files: { "/lang/php_xd.json": { "table.col": "Langsung Siap" } },
    });

    expect(screen.getByTestId("label").textContent).toBe("Langsung Siap");
  });

  it("tidak menutup lagi (anak tidak di-unmount) saat ganti bahasa", async () => {
    const mounts = vi.fn();
    function MountProbe() {
      const { setLocale, loading } = useLaravelReactI18n();
      return (
        <>
          <span data-testid="loading">{String(loading)}</span>
          <MountCounter onMount={mounts} />
          <button type="button" onClick={() => setLocale("xf2")}>
            ganti
          </button>
        </>
      );
    }
    function MountCounter({ onMount }) {
      useEffect(() => {
        onMount();
      }, [onMount]);
      return null;
    }

    const first = deferred();
    const second = deferred();
    const files = {
      "/lang/php_xf.json": () => first.promise,
      "/lang/php_xf2.json": () => second.promise,
    };

    render(
      <LaravelReactI18nProvider locale="xf" fallbackLocale="xf" files={files}>
        <I18nReadyGate files={files}>
          <MountProbe />
        </I18nReadyGate>
      </LaravelReactI18nProvider>,
    );

    await act(async () => {
      first.resolve({ default: {} });
      await first.promise;
    });
    expect(mounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      screen.getByRole("button", { name: "ganti" }).click();
    });
    // Selama bahasa baru dimuat, loading true lagi tapi anak harus tetap ada.
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(mounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      second.resolve({ default: {} });
      await second.promise;
    });
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});

describe("areI18nFilesEager", () => {
  it("false untuk glob lazy (fungsi)", () => {
    expect(
      areI18nFilesEager({ "/lang/a.json": () => Promise.resolve({}) }),
    ).toBe(false);
  });

  it("true untuk glob eager (objek modul)", () => {
    expect(areI18nFilesEager({ "/lang/a.json": { default: {} } })).toBe(true);
  });

  it("false untuk glob kosong atau undefined", () => {
    expect(areI18nFilesEager({})).toBe(false);
    expect(areI18nFilesEager(undefined)).toBe(false);
  });
});
