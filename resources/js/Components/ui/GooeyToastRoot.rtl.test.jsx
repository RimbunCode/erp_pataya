import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const tMock = vi.fn((key) => `TR:${key}`);
const useLaravelReactI18nMock = vi.fn(() => ({ t: tMock }));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => useLaravelReactI18nMock(),
}));

const setupInertiaToastMock = vi.fn();
vi.mock("@/lib/inertiaToast", () => ({
  setupInertiaToast: (...args) => setupInertiaToastMock(...args),
}));

vi.mock("@/Components/ui/goey-toaster", () => ({
  GooeyToaster: (props) => (
    <div
      data-testid="gooey-toaster-stub"
      data-close-button={String(props.closeButton)}
    />
  ),
}));

import GooeyToastRoot from "./GooeyToastRoot";

// GooeyToastRoot dipasang sekali di luar tree Inertia (lihat komentar JSDoc
// source) sehingga TIDAK boleh remount antar navigasi. Fokus test: dua
// tambahan non-trivial di atas wrapper GooeyToaster --
// (1) setup/teardown listener Inertia via setupInertiaToast di useEffect,
// (2) pola tRef untuk menghindari stale closure pada fungsi t yang
// diteruskan (translator function harus selalu memakai `t` TERBARU tanpa
// setupInertiaToast dipanggil ulang tiap kali `t` berubah referensinya).
describe("GooeyToastRoot", () => {
  beforeEach(() => {
    tMock.mockClear();
    useLaravelReactI18nMock.mockClear();
    useLaravelReactI18nMock.mockReturnValue({ t: tMock });
    setupInertiaToastMock.mockClear();
    setupInertiaToastMock.mockReturnValue(vi.fn());
  });

  it("merender GooeyToaster dengan prop closeButton", () => {
    render(<GooeyToastRoot />);

    const toaster = screen.getByTestId("gooey-toaster-stub");
    expect(toaster).toHaveAttribute("data-close-button", "true");
  });

  it("memanggil setupInertiaToast tepat satu kali saat mount dengan objek berisi fungsi t", () => {
    render(<GooeyToastRoot />);

    expect(setupInertiaToastMock).toHaveBeenCalledTimes(1);
    const arg = setupInertiaToastMock.mock.calls[0][0];
    expect(typeof arg.t).toBe("function");
  });

  it("fungsi t yang diteruskan ke setupInertiaToast mendelegasikan ke t dari useLaravelReactI18n", () => {
    render(<GooeyToastRoot />);

    const passedT = setupInertiaToastMock.mock.calls[0][0].t;
    const result = passedT("core.toast.loading");

    expect(result).toBe("TR:core.toast.loading");
    expect(tMock).toHaveBeenCalledWith("core.toast.loading");
  });

  it("fungsi t yang diteruskan tetap memakai t TERBARU setelah rerender dengan instance t baru (tidak stale)", () => {
    const { rerender } = render(<GooeyToastRoot />);
    const passedT = setupInertiaToastMock.mock.calls[0][0].t;

    const newTMock = vi.fn((key) => `NEW:${key}`);
    useLaravelReactI18nMock.mockReturnValue({ t: newTMock });
    rerender(<GooeyToastRoot />);

    expect(passedT("core.toast.success")).toBe("NEW:core.toast.success");
    expect(newTMock).toHaveBeenCalledWith("core.toast.success");
    // setupInertiaToast tidak boleh dipanggil ulang -- effect ke-2 punya deps [].
    expect(setupInertiaToastMock).toHaveBeenCalledTimes(1);
  });

  it("memanggil teardown yang dikembalikan setupInertiaToast saat unmount", () => {
    const teardown = vi.fn();
    setupInertiaToastMock.mockReturnValue(teardown);

    const { unmount } = render(<GooeyToastRoot />);
    expect(teardown).not.toHaveBeenCalled();

    unmount();

    expect(teardown).toHaveBeenCalledTimes(1);
  });
});
