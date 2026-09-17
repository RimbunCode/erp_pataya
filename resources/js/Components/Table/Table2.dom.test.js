import { describe, expect, it, beforeEach } from "vitest";
import {
  convertColWidth,
  datatableColumnsCookieKey,
  createHeaders,
} from "./Table2";

describe("convertColWidth", () => {
  it("mengonversi 'grow' menjadi '1fr'", () => {
    expect(convertColWidth("grow")).toBe("1fr");
  });

  it("mengonversi 'fit' menjadi 'max-content'", () => {
    expect(convertColWidth("fit")).toBe("max-content");
  });

  it("mengonversi 'minimum' menjadi 'min-content'", () => {
    expect(convertColWidth("minimum")).toBe("min-content");
  });

  it("meneruskan nilai custom (mis. '200px') apa adanya", () => {
    expect(convertColWidth("200px")).toBe("200px");
  });

  it("default ke 'minmax(120px, 1fr)' untuk value kosong/falsy", () => {
    expect(convertColWidth(null)).toBe("minmax(120px, 1fr)");
    expect(convertColWidth(undefined)).toBe("minmax(120px, 1fr)");
    expect(convertColWidth("")).toBe("minmax(120px, 1fr)");
  });
});

describe("datatableColumnsCookieKey", () => {
  it("menghasilkan key berbasis path yang di-slugify", () => {
    expect(datatableColumnsCookieKey("/Sales/Orders")).toBe(
      "datatable_columns_sales_orders",
    );
  });

  it("menghapus leading/trailing slash sebelum slugify", () => {
    expect(datatableColumnsCookieKey("/users/")).toBe(
      "datatable_columns_users",
    );
  });

  it("mengganti karakter non-alfanumerik dengan underscore", () => {
    expect(datatableColumnsCookieKey("/purchase-orders/list")).toBe(
      "datatable_columns_purchase_orders_list",
    );
  });

  it("selalu lowercase", () => {
    expect(datatableColumnsCookieKey("/Users/ManageUsers")).toBe(
      "datatable_columns_users_manageusers",
    );
  });

  it("fallback ke key generik untuk path kosong/root", () => {
    expect(datatableColumnsCookieKey("")).toBe("datatable_columns");
    expect(datatableColumnsCookieKey("/")).toBe("datatable_columns");
    expect(datatableColumnsCookieKey(null)).toBe("datatable_columns");
  });
});

describe("createHeaders", () => {
  beforeEach(() => {
    document.cookie = "datatable_columns_test=; path=/; max-age=0";
    window.history.pushState({}, "", "/test");
  });

  it("menampilkan semua kolom (show=true default) saat tidak ada cookie", () => {
    const headers = {
      name: { name: "name", title: "Name" },
      email: { name: "email", title: "Email" },
    };
    const result = createHeaders(headers, true); // ignoreCookie=true
    expect(result.every((h) => h.show === true)).toBe(true);
  });

  it("menghormati col.show=false eksplisit saat tidak ada cookie", () => {
    const headers = {
      name: { name: "name", title: "Name" },
      secret: { name: "secret", title: "Secret", show: false },
    };
    const result = createHeaders(headers, true);
    const secretCol = result.find((h) => h.name === "secret");
    expect(secretCol.show).toBe(false);
  });

  it("mengonversi width via convertColWidth ke properti size", () => {
    const headers = {
      name: { name: "name", title: "Name", width: "grow" },
    };
    const result = createHeaders(headers, true);
    expect(result[0].size).toBe("1fr");
  });

  it("mereset properti sort menjadi null untuk semua kolom", () => {
    const headers = {
      name: { name: "name", title: "Name", sort: "asc" },
    };
    const result = createHeaders(headers, true);
    expect(result[0].sort).toBeNull();
  });
});
