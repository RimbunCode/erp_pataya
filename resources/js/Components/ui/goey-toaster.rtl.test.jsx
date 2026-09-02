import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseTheme = vi.fn();
vi.mock("@/Hooks/useTheme", () => ({
  default: () => mockUseTheme(),
}));

// goey-toaster.jsx adalah wrapper tipis di atas GooeyToaster asli dari paket
// "goey-toast" -- animasi Framer Motion, Sonner Toaster, dan efek internalnya
// (MutationObserver, hotkey, dsb.) sudah tanggung jawab paket upstream, bukan
// wrapper kita. Stub agar test fokus HANYA ke apa yang wrapper kita
// tambahkan: resolusi prop `theme` dari useTheme(), default konfigurasi
// hardcoded (position/spring/preset/duration), dan bahwa props tambahan
// (termasuk override) diteruskan apa adanya ke komponen asli.
const gooeyToasterPropsSpy = vi.fn();
vi.mock("goey-toast", () => ({
  GooeyToaster: (props) => {
    gooeyToasterPropsSpy(props);
    return <div data-testid="mock-gooey-toaster" />;
  },
}));

import { GooeyToaster, default as GooeyToasterDefault } from "./goey-toaster";

describe("GooeyToaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({ currentTheme: "light" });
  });

  it("render tanpa crash meneruskan ke GooeyToaster asli dari goey-toast", () => {
    render(<GooeyToaster />);
    expect(screen.getByTestId("mock-gooey-toaster")).toBeInTheDocument();
    expect(gooeyToasterPropsSpy).toHaveBeenCalledTimes(1);
  });

  it("named export dan default export merujuk komponen yang sama", () => {
    expect(GooeyToasterDefault).toBe(GooeyToaster);
  });

  it("konfigurasi default hardcoded diteruskan ketika tidak ada prop diberikan", () => {
    render(<GooeyToaster />);

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.position).toBe("top-center");
    expect(props.spring).toBe(true);
    expect(props.preset).toBe("smooth");
    expect(props.duration).toBe(5000);
  });

  it("currentTheme='dark' dari useTheme() menghasilkan prop theme='dark'", () => {
    mockUseTheme.mockReturnValue({ currentTheme: "dark" });
    render(<GooeyToaster />);

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.theme).toBe("dark");
  });

  it("currentTheme='light' dari useTheme() menghasilkan prop theme='light'", () => {
    mockUseTheme.mockReturnValue({ currentTheme: "light" });
    render(<GooeyToaster />);

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.theme).toBe("light");
  });

  it("currentTheme selain 'dark' (mis. belum ter-resolve / undefined) jatuh ke theme='light'", () => {
    mockUseTheme.mockReturnValue({ currentTheme: undefined });
    render(<GooeyToaster />);

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.theme).toBe("light");
  });

  it("prop tambahan (mis. gap) diteruskan apa adanya ke komponen asli", () => {
    render(<GooeyToaster gap={20} />);

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.gap).toBe(20);
  });

  it("prop yang di-spread meng-override default hardcoded (position, duration, preset, spring)", () => {
    render(
      <GooeyToaster
        position="bottom-right"
        duration={3000}
        preset="bouncy"
        spring={false}
      />,
    );

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.position).toBe("bottom-right");
    expect(props.duration).toBe(3000);
    expect(props.preset).toBe("bouncy");
    expect(props.spring).toBe(false);
  });

  it("prop theme eksplisit dari caller meng-override hasil resolusi useTheme()", () => {
    mockUseTheme.mockReturnValue({ currentTheme: "dark" });
    render(<GooeyToaster theme="light" />);

    const props = gooeyToasterPropsSpy.mock.calls[0][0];
    expect(props.theme).toBe("light");
  });
});
