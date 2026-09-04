import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// MasterLayout membungkus banyak side effect tidak terkait GuestLayout
// sendiri (tema, AlertDialogs, context-menu guard, dst -- lihat
// AppLayout.rtl.test.jsx utk pola serupa). Stub jadi passthrough supaya
// test fokus ke struktur composisi GuestLayout SENDIRI (Avatar + Card +
// children), bukan re-test implementasi internal MasterLayout.
const masterLayoutProps = {};
vi.mock("./MasterLayout", () => ({
  default: (props) => {
    Object.assign(masterLayoutProps, props);
    return <div data-testid="stub-master-layout">{props.children}</div>;
  },
}));

// AvatarImage (Radix Avatar) hanya merender <img> setelah event load/error
// dari objek window.Image() internal terpicu -- ini TIDAK PERNAH terjadi di
// jsdom (tidak ada network loading sungguhan), jadi <img> tidak pernah
// muncul di DOM walau src valid (lihat ui/avatar.rtl.test.jsx dan
// Pages/Users/ManageUsers/Show.rtl.test.jsx utk dokumentasi pola yg sama).
// Stub AvatarImage jadi <img> polos, Avatar/AvatarFallback tetap asli, supaya
// src yg dihitung GuestLayout sendiri (route("company-logo") + cache-bust
// dari preferences.updated_at) bisa diverifikasi lewat DOM biasa.
vi.mock("@/Components/ui/avatar", async () => {
  const actual = await vi.importActual("@/Components/ui/avatar");
  return {
    ...actual,
    AvatarImage: ({ src, alt, className }) => (
      <img src={src} alt={alt} className={className} />
    ),
  };
});

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const routeMock = vi.fn((name) => name);
window.route = (...args) => routeMock(...args);

import GuestLayout from "./GuestLayout";

function setPreferences(updated_at) {
  usePageMock.mockReturnValue({ props: { preferences: { updated_at } } });
}

function clearCaptured() {
  for (const key of Object.keys(masterLayoutProps)) {
    delete masterLayoutProps[key];
  }
}

beforeEach(() => {
  usePageMock.mockReset();
  routeMock.mockClear();
  clearCaptured();
  setPreferences("2026-01-01T00:00:00.000Z");
});

describe("GuestLayout — render dasar & struktur", () => {
  it("merender konten di dalam MasterLayout", () => {
    render(
      <GuestLayout>
        <p>konten guest</p>
      </GuestLayout>,
    );

    const master = screen.getByTestId("stub-master-layout");
    expect(master).toBeInTheDocument();
    expect(screen.getByText("konten guest")).toBeInTheDocument();
  });

  it("wrapper terluar (di dalam MasterLayout) memakai className layout guest yg diharapkan", () => {
    const { container } = render(<GuestLayout>x</GuestLayout>);

    const wrapper = container.querySelector(".min-h-screen");
    expect(wrapper).not.toBeNull();
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("flex-col");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("bg-gray-100");
    expect(wrapper.className).toContain("dark:bg-gray-900");
  });

  it("Avatar logo memakai className 'relative h-auto w-64 group'", () => {
    render(<GuestLayout>x</GuestLayout>);

    const img = screen.getByRole("img");
    const avatarSpan = img.closest("span");
    expect(avatarSpan).not.toBeNull();
    expect(avatarSpan.className).toContain("h-auto");
    expect(avatarSpan.className).toContain("w-64");
    expect(avatarSpan.className).toContain("group");
  });

  it("AvatarImage menerima className 'object-contain aspect-auto'", () => {
    render(<GuestLayout>x</GuestLayout>);

    const img = screen.getByRole("img");
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("aspect-auto");
  });
});

describe("GuestLayout — src logo (route company-logo + cache-bust)", () => {
  it("memanggil route('company-logo') tanpa parameter tambahan", () => {
    render(<GuestLayout>x</GuestLayout>);

    expect(routeMock).toHaveBeenCalledWith("company-logo");
  });

  it("src = hasil route('company-logo') + '?v=' + timestamp dari preferences.updated_at", () => {
    setPreferences("2026-01-01T00:00:00.000Z");
    render(<GuestLayout>x</GuestLayout>);

    const expectedTimestamp = new Date("2026-01-01T00:00:00.000Z").getTime();
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe(`company-logo?v=${expectedTimestamp}`);
  });

  it("cache-bust berubah mengikuti perubahan preferences.updated_at", () => {
    setPreferences("2020-05-05T10:00:00.000Z");
    const { unmount } = render(<GuestLayout>x</GuestLayout>);
    const firstTimestamp = new Date("2020-05-05T10:00:00.000Z").getTime();
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      `company-logo?v=${firstTimestamp}`,
    );
    unmount();

    setPreferences("2025-12-31T23:59:59.000Z");
    render(<GuestLayout>x</GuestLayout>);
    const secondTimestamp = new Date("2025-12-31T23:59:59.000Z").getTime();
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      `company-logo?v=${secondTimestamp}`,
    );
    expect(secondTimestamp).not.toBe(firstTimestamp);
  });
});

describe("GuestLayout — Card pembungkus children & className merge", () => {
  it("merender children di dalam Card dgn className default 'w-full max-w-md mt-4'", () => {
    render(
      <GuestLayout>
        <p data-testid="child">isi form</p>
      </GuestLayout>,
    );

    const child = screen.getByTestId("child");
    const card = child.parentElement;
    expect(card.className).toContain("w-full");
    expect(card.className).toContain("max-w-md");
    expect(card.className).toContain("mt-4");
  });

  it("className custom digabung dgn className default Card (cn merge), bukan menimpa", () => {
    render(
      <GuestLayout className="custom-guest-card">
        <p data-testid="child">isi form</p>
      </GuestLayout>,
    );

    const card = screen.getByTestId("child").parentElement;
    expect(card.className).toContain("custom-guest-card");
    expect(card.className).toContain("max-w-md");
    expect(card.className).toContain("w-full");
  });

  it("children apa adanya dirender (mendukung banyak node, bukan cuma string tunggal)", () => {
    render(
      <GuestLayout>
        <p>baris satu</p>
        <button type="button">Kirim</button>
      </GuestLayout>,
    );

    expect(screen.getByText("baris satu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim" })).toBeInTheDocument();
  });
});
