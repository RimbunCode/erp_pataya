import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { forwardRef } from "react";
import { vi } from "vitest";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: {}, url: "/test" }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// DndContext ASLI dipertahankan -- hanya dibungkus utk menangkap referensi
// onDragOver ASLI (handleDragOver di Table2.jsx, closure komponen) supaya
// bisa dipanggil manual dgn objek {active, over} palsu. Simulasi drag
// pointer fisik di jsdom rapuh/flaky, jadi dihindari (lihat pola sama di
// ColumnOrderPicker.rtl.test.jsx).
let capturedOnDragOver;
vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props) => {
      capturedOnDragOver = props.onDragOver;
      return <actual.DndContext {...props} />;
    },
  };
});

// Header ASLI (dnd-kit) di-stub minimal -- forwardRef ke <th> asli tetap
// diteruskan (Table2 butuh offsetLeft/offsetWidth via useDynamicRefs untuk
// hitung resize), dan onResize diekspos lewat tombol supaya resize bisa
// dipicu langsung tanpa simulasi pointer event dnd-kit yang rapuh di jsdom
// (lihat pola sama di ColumnOrderPicker.rtl.test.jsx/DashboardCanvas.rtl.test.jsx).
vi.mock("./Header", () => ({
  default: forwardRef(function HeaderStub(
    { id, title, onResize, onResetSize },
    ref,
  ) {
    return (
      <th ref={ref} data-testid={`header-${id}`}>
        {title}
        <button data-testid={`resize-${id}`} onClick={onResize} />
        <button data-testid={`reset-${id}`} onClick={onResetSize} />
      </th>
    );
  }),
}));

import Table2, { datatableColumnsCookieKey } from "./Table2";

// "code" sengaja diberi width beda dari "name" (default) -- kalau sama,
// string gridTemplateColumns hasil join tidak berubah walau URUTAN kolom
// berubah, sehingga React skip-diff style dan residual DOM lama (yang
// kebetulan masih benar) menyamarkan bug meski FIX belum ada.
const columns = {
  name: { name: "name", title: "Name", type: "text" },
  code: { name: "code", title: "Code", type: "text", width: "180px" },
};

const data = [{ id: 1, name: "Item A", code: "A1" }];

function readSizeCookie() {
  const key = datatableColumnsCookieKey(window.location.pathname);
  const match = document.cookie.match(new RegExp(`${key}=([^;]+)`));
  return match ? JSON.parse(match[1]) : null;
}

function resizeColumn(getByTestId, columnName, clientX) {
  // act() eksplisit per step: listener mousemove/mouseup di-attach lewat
  // useEffect(activeIndex) yang baru flush setelah commit React -- tanpa
  // ini, dispatchEvent berikutnya bisa mendahului effect-nya terpasang.
  act(() => {
    getByTestId(`resize-${columnName}`).click();
  });
  act(() => {
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX, bubbles: true }),
    );
  });
  act(() => {
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

describe("Table2 resize persistence", () => {
  beforeEach(() => {
    document.cookie = "";
  });

  afterEach(() => {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      }
    });
  });

  it("size hasil resize manual tersimpan ke state (cookie) setelah mouseup", () => {
    const { getByTestId } = render(<Table2 columns={columns} data={data} />);

    resizeColumn(getByTestId, "name", 250);

    expect(readSizeCookie()?.name?.size).toBe("250px");
  });

  it("size hasil resize tidak hilang saat kolom lain di-drag-reorder (bug report user)", () => {
    const { getByTestId, container } = render(
      <Table2 columns={columns} data={data} />,
    );

    resizeColumn(getByTestId, "name", 250);
    expect(readSizeCookie()?.name?.size).toBe("250px");

    // Reorder ASLI (bukan cuma re-render): pindahkan "code" ke posisi
    // "name". Ini mengubah URUTAN token gridTemplateColumns, jadi beda dari
    // sekadar activeIndex berubah -- React tidak bisa skip-diff style-nya.
    // Sebelum fix, <table> dihitung ulang dari col.width (default),
    // menimpa balik size custom kolom "name".
    act(() => {
      capturedOnDragOver({ active: { id: "code" }, over: { id: "name" } });
    });

    const table = container.querySelector("table.resizeable-table");
    expect(table.style.gridTemplateColumns).toContain("250px");
  });

  it("reset ukuran kolom (double-click) tersimpan ke state, bukan cuma DOM", () => {
    const { getByTestId } = render(<Table2 columns={columns} data={data} />);

    resizeColumn(getByTestId, "name", 250);
    expect(readSizeCookie()?.name?.size).toBe("250px");

    // Sebelumnya: setColumns(columns, newColumns) -- argumen kedua (size
    // hasil reset) diabaikan React, yang ke-commit cuma state lama (masih
    // "250px"). Reset harus benar-benar balik ke default fr-minmax.
    act(() => {
      getByTestId("reset-name").click();
    });

    expect(readSizeCookie()?.name?.size).toBe("minmax(120px, 1fr)");
  });
});
