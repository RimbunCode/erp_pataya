/**
 * Unit test untuk resources/js/lib/deskIcons.jsx.
 *
 * Ketiga fungsi yang diuji (resolveIcon, resolveMenuIcon, getDeskColorStyle)
 * adalah fungsi murni: resolveIcon/resolveMenuIcon memang mengembalikan
 * elemen React (JSX), tapi `<Icon />` hanyalah pemanggilan
 * React.createElement() -- objek deskriptor biasa ({ type, props, ... })
 * yang TIDAK butuh DOM untuk dibuat. Behavior-nya (icon mana yang ke-resolve,
 * fallback inisial apa yang muncul) bisa diverifikasi cukup dengan
 * introspeksi element.type/element.props, tanpa render sungguhan ke jsdom --
 * sesuai prioritas test project ini: unit test fungsi murni (.test.js, node)
 * lebih diutamakan daripada RTL kalau logic bisa diuji tanpa render.
 */

import { describe, it, expect } from "vitest";
import * as lucideIcons from "lucide-react";
import {
  resolveIcon,
  resolveMenuIcon,
  getDeskColorStyle,
} from "./deskIcons.jsx";

describe("resolveIcon", () => {
  it("nama icon lucide-react valid -> element dgn type = komponen lucide yg sesuai", () => {
    const result = resolveIcon("RocketIcon");

    expect(result).not.toBeNull();
    expect(result.type).toBe(lucideIcons.RocketIcon);
    expect(result.props).toEqual({});
  });

  it("nama icon lucide-react lain (SettingsIcon) juga ke-resolve ke referensi yg sama", () => {
    const result = resolveIcon("SettingsIcon");

    expect(result.type).toBe(lucideIcons.SettingsIcon);
  });

  it('nama "ServiceIcon" (custom, bukan lucide) ke-resolve ke komponen custom lokal', () => {
    const result = resolveIcon("ServiceIcon");

    expect(result).not.toBeNull();
    // customIcons.ServiceIcon tidak di-export dari module -- verifikasi via
    // nama fungsi (function declaration bernama ServiceIcon di source) dan
    // pastikan bukan kebetulan match export lucide-react (tidak ada).
    expect(result.type.name).toBe("ServiceIcon");
    expect(lucideIcons.ServiceIcon).toBeUndefined();
  });

  it('nama "CustomerIcon" (custom, bukan lucide) ke-resolve ke komponen custom lokal', () => {
    const result = resolveIcon("CustomerIcon");

    expect(result).not.toBeNull();
    expect(result.type.name).toBe("CustomerIcon");
    expect(lucideIcons.CustomerIcon).toBeUndefined();
  });

  it("nama yg tidak dikenal (bukan custom, bukan lucide) -> null", () => {
    expect(resolveIcon("BukanIconYangAda123")).toBeNull();
  });

  it("nama undefined -> null", () => {
    expect(resolveIcon(undefined)).toBeNull();
  });

  it("nama string kosong -> null", () => {
    expect(resolveIcon("")).toBeNull();
  });
});

describe("resolveMenuIcon", () => {
  it("nama icon valid -> mengembalikan icon yg sama persis dgn resolveIcon (label diabaikan)", () => {
    const result = resolveMenuIcon("RocketIcon", "Label diabaikan total");

    expect(result.type).toBe(lucideIcons.RocketIcon);
  });

  it("nama icon tidak ke-resolve -> fallback <span> inisial dari label 2 kata", () => {
    const result = resolveMenuIcon("BukanIconYangAda123", "John Doe");

    expect(result.type).toBe("span");
    expect(result.props.className).toBe(
      "flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground",
    );
    expect(result.props.children).toBe("JD");
  });

  it("fallback: label 1 kata -> inisial 1 huruf", () => {
    const result = resolveMenuIcon(undefined, "Marketing");

    expect(result.props.children).toBe("M");
  });

  it("fallback: label >2 kata -> inisial diambil dari 2 kata pertama saja", () => {
    const result = resolveMenuIcon(undefined, "Alpha Beta Gamma");

    expect(result.props.children).toBe("AB");
  });

  it("fallback: label lowercase -> inisial di-uppercase", () => {
    const result = resolveMenuIcon(undefined, "alpha beta");

    expect(result.props.children).toBe("AB");
  });

  it("fallback: label dgn spasi ganda di antara & di pinggir -> kata kosong difilter", () => {
    const result = resolveMenuIcon(undefined, "  John   Doe  ");

    expect(result.props.children).toBe("JD");
  });

  it("fallback: label undefined -> inisial string kosong (bukan crash)", () => {
    const result = resolveMenuIcon(undefined, undefined);

    expect(result.type).toBe("span");
    expect(result.props.children).toBe("");
  });

  it("fallback: label null -> inisial string kosong", () => {
    const result = resolveMenuIcon(undefined, null);

    expect(result.props.children).toBe("");
  });

  it("fallback: label string kosong -> inisial string kosong", () => {
    const result = resolveMenuIcon(undefined, "");

    expect(result.props.children).toBe("");
  });
});

describe("getDeskColorStyle", () => {
  it("desk undefined -> style kosong, className full fallback ke token tema", () => {
    const result = getDeskColorStyle(undefined);

    expect(result.style).toEqual({});
    expect(result.className).toBe("border bg-muted text-foreground");
  });

  it("desk object kosong (tanpa background_color/foreground_color) -> sama spt undefined", () => {
    const result = getDeskColorStyle({});

    expect(result.style).toEqual({});
    expect(result.className).toBe("border bg-muted text-foreground");
  });

  it("hanya background_color di-set -> style.backgroundColor terisi, class bg-muted hilang tapi text-foreground tetap", () => {
    const result = getDeskColorStyle({ background_color: "#ff0000" });

    expect(result.style).toEqual({ backgroundColor: "#ff0000" });
    expect(result.className).toBe("border text-foreground");
  });

  it("hanya foreground_color di-set -> style.color terisi, class text-foreground hilang tapi bg-muted tetap", () => {
    const result = getDeskColorStyle({ foreground_color: "#00ff00" });

    expect(result.style).toEqual({ color: "#00ff00" });
    expect(result.className).toBe("border bg-muted");
  });

  it("kedua warna di-set -> style berisi keduanya, className cuma 'border' (tanpa fallback token apapun)", () => {
    const result = getDeskColorStyle({
      background_color: "#ff0000",
      foreground_color: "#00ff00",
    });

    expect(result.style).toEqual({
      backgroundColor: "#ff0000",
      color: "#00ff00",
    });
    expect(result.className).toBe("border");
  });

  it("background_color/foreground_color string kosong dianggap tidak di-set (falsy)", () => {
    const result = getDeskColorStyle({
      background_color: "",
      foreground_color: "",
    });

    expect(result.style).toEqual({});
    expect(result.className).toBe("border bg-muted text-foreground");
  });
});
