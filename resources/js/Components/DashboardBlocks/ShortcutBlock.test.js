import { describe, expect, it } from "vitest";

import { resolveShortcutHref } from "./ShortcutBlock";

// resolveShortcutHref() adalah fungsi murni (tanpa DOM) yang menentukan href
// hasil resolusi config link_type/link_to (dipakai jg oleh LinkCardBlock) --
// diuji terpisah di sini sesuai prioritas unit test murni, sebelum test
// render komponennya sendiri (lihat ShortcutBlock.rtl.test.jsx).
describe("resolveShortcutHref", () => {
  describe("link_type 'url'", () => {
    it("mengembalikan link_to apa adanya", () => {
      expect(
        resolveShortcutHref(
          { link_type: "url", link_to: "https://contoh.test" },
          [],
        ),
      ).toBe("https://contoh.test");
    });

    it("mengembalikan null kalau link_to kosong (string kosong)", () => {
      expect(
        resolveShortcutHref({ link_type: "url", link_to: "" }, []),
      ).toBeNull();
    });

    it("mengembalikan null kalau link_to null/tidak diset", () => {
      expect(
        resolveShortcutHref({ link_type: "url", link_to: null }, []),
      ).toBeNull();
      expect(resolveShortcutHref({ link_type: "url" }, [])).toBeNull();
    });

    it("TIDAK mencari ke allMenuItems sama sekali walau link_to kebetulan cocok dgn id salah satu item", () => {
      // link_type url berarti link_to sudah berupa URL literal, bukan id
      // menu_item -- allMenuItems diabaikan sepenuhnya di cabang ini.
      expect(
        resolveShortcutHref({ link_type: "url", link_to: "5" }, [
          { id: "5", url: "/harusnya-tidak-dipakai" },
        ]),
      ).toBe("5");
    });
  });

  describe("link_type 'menu_item'", () => {
    const allMenuItems = [
      { id: 5, url: "/menu/lima" },
      { id: 7, url: "/menu/tujuh" },
    ];

    it("mencari menu item yang id-nya cocok dgn link_to & mengembalikan url-nya", () => {
      expect(
        resolveShortcutHref(
          { link_type: "menu_item", link_to: 5 },
          allMenuItems,
        ),
      ).toBe("/menu/lima");
    });

    it("mengembalikan null kalau tidak ada menu item yang id-nya cocok", () => {
      expect(
        resolveShortcutHref(
          { link_type: "menu_item", link_to: 999 },
          allMenuItems,
        ),
      ).toBeNull();
    });

    it("mengembalikan null kalau menu item ketemu tapi field url-nya null/undefined", () => {
      expect(
        resolveShortcutHref({ link_type: "menu_item", link_to: 1 }, [
          { id: 1, url: null },
        ]),
      ).toBeNull();
      expect(
        resolveShortcutHref({ link_type: "menu_item", link_to: 1 }, [
          { id: 1 },
        ]),
      ).toBeNull();
    });
  });

  describe("allMenuItems tidak tersedia / kosong", () => {
    it("tidak crash & mengembalikan null kalau allMenuItems undefined", () => {
      expect(
        resolveShortcutHref({ link_type: "menu_item", link_to: 5 }, undefined),
      ).toBeNull();
    });

    it("tidak crash & mengembalikan null kalau allMenuItems array kosong", () => {
      expect(
        resolveShortcutHref({ link_type: "menu_item", link_to: 5 }, []),
      ).toBeNull();
    });
  });

  describe("config kosong/tak terduga", () => {
    it("mengembalikan null kalau config undefined", () => {
      expect(resolveShortcutHref(undefined, [])).toBeNull();
    });

    it("mengembalikan null kalau config null", () => {
      expect(resolveShortcutHref(null, [])).toBeNull();
    });

    it("link_type selain 'url' (mis. tidak diset) diperlakukan sbg lookup menu_item", () => {
      expect(
        resolveShortcutHref({ link_to: 5 }, [{ id: 5, url: "/menu/lima" }]),
      ).toBe("/menu/lima");
    });
  });
});
