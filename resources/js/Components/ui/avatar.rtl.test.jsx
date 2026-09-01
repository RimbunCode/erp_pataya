import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

describe("Avatar", () => {
  it("render sebagai <span> dengan className default", () => {
    render(<Avatar data-testid="avatar" />);
    const root = screen.getByTestId("avatar");
    expect(root.tagName).toBe("SPAN");
    expect(root.className).toContain("relative");
    expect(root.className).toContain("rounded-full");
    expect(root.className).toContain("h-10");
    expect(root.className).toContain("w-10");
  });

  it("menggabungkan className custom dengan default (bukan menghapusnya)", () => {
    render(<Avatar data-testid="avatar" className="ring-2 ring-red-500" />);
    const root = screen.getByTestId("avatar");
    expect(root.className).toContain("ring-2");
    expect(root.className).toContain("ring-red-500");
    expect(root.className).toContain("rounded-full");
  });

  it("meneruskan props HTML lain (mis. title, data-testid) ke elemen root", () => {
    render(<Avatar data-testid="avatar" title="User avatar" />);
    expect(screen.getByTestId("avatar")).toHaveAttribute(
      "title",
      "User avatar",
    );
  });

  it("forwardRef meneruskan ref ke elemen <span> root asli", () => {
    const ref = createRef();
    render(<Avatar ref={ref} data-testid="avatar" />);
    expect(ref.current).toBe(screen.getByTestId("avatar"));
    expect(ref.current.tagName).toBe("SPAN");
  });
});

describe("AvatarFallback", () => {
  it("render children dengan className default saat dirender di dalam <Avatar>", () => {
    render(
      <Avatar>
        <AvatarFallback data-testid="fallback">AB</AvatarFallback>
      </Avatar>,
    );
    const fallback = screen.getByTestId("fallback");
    expect(fallback).toHaveTextContent("AB");
    expect(fallback.className).toContain("rounded-full");
    expect(fallback.className).toContain("bg-muted");
    expect(fallback.className).toContain("items-center");
    expect(fallback.className).toContain("justify-center");
  });

  it("menggabungkan className custom dengan default (bukan menghapusnya)", () => {
    render(
      <Avatar>
        <AvatarFallback data-testid="fallback" className="text-red-500">
          AB
        </AvatarFallback>
      </Avatar>,
    );
    const fallback = screen.getByTestId("fallback");
    expect(fallback.className).toContain("text-red-500");
    expect(fallback.className).toContain("bg-muted");
  });

  it("meneruskan props HTML lain (mis. aria-label) ke elemen fallback", () => {
    render(
      <Avatar>
        <AvatarFallback aria-label="inisial pengguna" data-testid="fallback">
          AB
        </AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByTestId("fallback")).toHaveAttribute(
      "aria-label",
      "inisial pengguna",
    );
  });

  it("forwardRef meneruskan ref ke elemen DOM fallback asli", () => {
    const ref = createRef();
    render(
      <Avatar>
        <AvatarFallback ref={ref} data-testid="fallback">
          AB
        </AvatarFallback>
      </Avatar>,
    );
    expect(ref.current).toBe(screen.getByTestId("fallback"));
    expect(ref.current.tagName).toBe("SPAN");
  });
});

describe("AvatarImage", () => {
  // Radix AvatarImage hanya merender elemen <img> setelah status loading
  // internalnya mencapai 'loaded', yang di-drive lewat event load/error pada
  // objek `window.Image()` yang dibuat manual di dalam hook Radix -- event
  // itu TIDAK PERNAH terpicu secara otomatis di jsdom (tidak ada network
  // loading sungguhan). Jadi <img> tidak pernah muncul di DOM di lingkungan
  // test ini, dan AvatarFallback tetap tampil sebagai gantinya. Ini perilaku
  // upstream Radix (bukan sesuatu yang ditambahkan wrapper ini), sama seperti
  // yang sudah didokumentasikan & dikerjakan sekitar (mock AvatarImage) di
  // resources/js/Pages/Users/ManageUsers/Show.rtl.test.jsx dan
  // resources/js/Pages/Inventory/Items/Show.rtl.test.jsx.
  it("tidak merender <img> di jsdom walau src diberikan; AvatarFallback tetap tampil", () => {
    render(
      <Avatar>
        <AvatarImage
          data-testid="avatar-image"
          src="https://example.com/avatar.png"
          alt="User"
        />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );

    expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AB")).toBeInTheDocument();
  });
});
