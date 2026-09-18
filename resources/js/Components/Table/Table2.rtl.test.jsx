import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// Header (drag handle, resize handle, sort UI) punya kompleksitas dnd-kit
// tersendiri -- stub agar test Table2 fokus ke wrapper: selectable checkbox,
// loading/empty state, cell rendering dasar.
vi.mock("./Header", () => ({
  default: ({ title, id }) => <th data-testid={`header-${id}`}>{title}</th>,
}));

import Table2 from "./Table2";

const columns = {
  name: { name: "name", title: "Name", type: "text" },
};

const data = [
  { id: 1, name: "Item A" },
  { id: 2, name: "Item B" },
];

describe("Table2", () => {
  it("menampilkan loading state saat isLoading=true", () => {
    render(<Table2 columns={columns} data={[]} isLoading />);
    expect(screen.getByText(/TR:core.form.loading/)).toBeInTheDocument();
  });

  it("menampilkan NoDataImg saat data kosong dan bukan dynamic data", () => {
    render(<Table2 columns={columns} data={[]} />);
    expect(screen.queryByText(/TR:core.form.loading/)).not.toBeInTheDocument();
  });

  it("menampilkan pesan no_data saat data kosong dan isDynamicData=true", () => {
    render(<Table2 columns={columns} data={[]} isDynamicData />);
    expect(screen.getByText(/TR:core.datatable.no_data/)).toBeInTheDocument();
  });

  it("merender baris data dengan header kolom yang diberikan", () => {
    render(<Table2 columns={columns} data={data} />);
    expect(screen.getByTestId("header-name")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });

  it("tidak merender checkbox saat selectable=false", () => {
    render(<Table2 columns={columns} data={data} selectable={false} />);
    expect(screen.queryAllByRole("forminput")).toHaveLength(0);
  });

  it("selectable=true merender checkbox per baris + 1 checkbox select-all di header", () => {
    render(<Table2 columns={columns} data={data} selectable />);
    // 2 baris + 1 select-all header
    expect(screen.getAllByRole("forminput")).toHaveLength(3);
  });

  it("klik checkbox select-all menandai semua baris terpilih", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table2 columns={columns} data={data} selectable />);

    const [selectAll, ...rowChecks] = screen.getAllByRole("forminput");
    await user.click(selectAll);

    rowChecks.forEach((cb) =>
      expect(cb).toHaveAttribute("data-state", "checked"),
    );
  });

  // Task 6 (spec linkmodel-advanced-search) — onRowClick: mode single-select
  // klik-langsung (dipakai Advance Search Dialog), independen dari `selectable`
  // (checkbox multi-select, dipakai SelectModel). Prop opsional, default
  // undefined -- tidak boleh mengubah perilaku existing (selectable tetap jalan).
  it("onRowClick terisi -- klik baris memanggil callback dengan row yang benar, tanpa checkbox", async () => {
    const user = userEvent.setup({ delay: null });
    const onRowClick = vi.fn();
    render(<Table2 columns={columns} data={data} onRowClick={onRowClick} />);

    expect(screen.queryAllByRole("forminput")).toHaveLength(0);

    await user.click(screen.getByText("Item B"));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(data[1]);
  });

  it("onRowClick tidak diisi (default) -- klik baris tidak memicu apapun (regresi)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table2 columns={columns} data={data} />);

    // Tidak ada assertion callback (tak ada prop) -- cukup pastikan klik tidak throw.
    await expect(user.click(screen.getByText("Item A"))).resolves.not.toThrow();
  });

  // Kolom isLink tanpa `route` (mis. dari SelectModel/useSelectModel yang tak
  // menurunkan route seperti DataTable2) dulu crash: window.route(route ?? "", ...)
  // memanggil Ziggy dengan nama route kosong, lalu Link (Inertia mergeDataIntoQueryString)
  // memanggil href.toString() pada Router object rusak → "Cannot convert undefined
  // or null to object". Cell harus fallback ke teks biasa, bukan <Link>.
  it("kolom isLink tanpa route dirender sebagai teks biasa, bukan Link", () => {
    window.route = vi.fn(() => "/should-not-be-called");
    const isLinkColumns = {
      code: {
        name: "code",
        title: "Code",
        type: "string",
        isLink: true,
        primaryKey: "id",
      },
    };
    render(
      <Table2
        columns={isLinkColumns}
        data={[{ id: 1, code: "PSN/PR-0001" }]}
        persistColumns={false}
        isDynamicData
      />,
    );

    expect(screen.getByText("PSN/PR-0001")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(window.route).not.toHaveBeenCalled();
  });

  it("kolom isLink dengan route tetap dirender sebagai Link", () => {
    window.route = vi.fn(() => "/purchase-requests/1");
    const isLinkColumns = {
      code: {
        name: "code",
        title: "Code",
        type: "string",
        isLink: true,
        route: "purchaseRequests.show",
        primaryKey: "id",
      },
    };
    render(
      <Table2
        columns={isLinkColumns}
        data={[{ id: 1, code: "PSN/PR-0001" }]}
        persistColumns={false}
        isDynamicData
      />,
    );

    expect(screen.getByRole("link", { name: "PSN/PR-0001" })).toHaveAttribute(
      "href",
      "/purchase-requests/1",
    );
    expect(window.route).toHaveBeenCalledWith("purchaseRequests.show", 1);
  });

  describe("grouping (groupBy/groupCounts)", () => {
    const groupData = [
      { id: 1, name: "Item A", category: "fruit" },
      { id: 2, name: "Item B", category: "fruit" },
      { id: 3, name: "Item C", category: "vegetable" },
    ];

    it("merender header grup dari run-length data, label count dari groupCounts (bukan data.length per grup)", () => {
      render(
        <Table2
          columns={columns}
          data={groupData}
          groupBy="category"
          groupCounts={{ fruit: 10, vegetable: 3 }}
        />,
      );

      expect(screen.getByText("fruit")).toBeInTheDocument();
      expect(screen.getByText("(10)")).toBeInTheDocument();
      expect(screen.getByText("vegetable")).toBeInTheDocument();
      expect(screen.getByText("(3)")).toBeInTheDocument();
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });

    it("klik toggle collapse menyembunyikan baris grup itu, klik lagi memunculkan kembali", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Table2
          columns={columns}
          data={groupData}
          groupBy="category"
          groupCounts={{ fruit: 2, vegetable: 1 }}
        />,
      );

      const fruitHeader = screen.getByText("fruit").closest("td");
      await user.click(fruitHeader);

      expect(screen.queryByText("Item A")).not.toBeInTheDocument();
      expect(screen.queryByText("Item B")).not.toBeInTheDocument();
      // Grup lain (vegetable) tidak ikut terpengaruh.
      expect(screen.getByText("Item C")).toBeInTheDocument();

      await user.click(fruitHeader);
      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.getByText("Item B")).toBeInTheDocument();
    });

    it("baris dgn value groupBy null tidak crash, dirender sbg satu grup 'null' dgn count yang benar", () => {
      // Regresi #1 (crash): sentinel lama `item.groupHeader !== undefined`
      // ambigu saat value grup ITU SENDIRI undefined/null (mis. akun
      // grup/header di chart-of-accounts yang account_type-nya belum diisi)
      // -- item header disalahbaca sbg item baris biasa, lalu row[groupBy]
      // meledak krn `row` sebenarnya adalah objek header, bukan data.
      // Regresi #2 (count salah): lookup groupCounts pakai groupValue mentah
      // (null) alih-alih groupKey yang sudah di-String()-kan -- groupCounts[null]
      // di JS jadi groupCounts["null"], BUKAN match dgn value asli.
      // Ditemukan saat visual test browser (Account.account_type null utk
      // akun grup/header) -- tidak ketangkep test lama sebelum fix ini.
      const dataWithNullGroupValue = [
        { id: 1, name: "No Category A", category: null },
        { id: 2, name: "No Category B", category: null },
        { id: 3, name: "Fruit 1", category: "fruit" },
      ];
      expect(() =>
        render(
          <Table2
            columns={columns}
            data={dataWithNullGroupValue}
            groupBy="category"
            groupCounts={{ null: 2, fruit: 1 }}
          />,
        ),
      ).not.toThrow();

      expect(screen.getByText("No Category A")).toBeInTheDocument();
      expect(screen.getByText("No Category B")).toBeInTheDocument();
      expect(screen.getByText("Fruit 1")).toBeInTheDocument();
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    it("groupBy null/tidak diberikan -- tidak ada header grup sama sekali (regresi 73+ halaman existing)", () => {
      render(<Table2 columns={columns} data={groupData} />);

      expect(screen.queryByText("fruit")).not.toBeInTheDocument();
      expect(screen.queryByText("vegetable")).not.toBeInTheDocument();
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });

    it("groupBy diisi tapi groupCounts null (BE tolak kolom sudah tak groupable) -- fallback render flat, TIDAK duplicate header salah (regresi bug user: Ticket status double group + count 0)", () => {
      const nonContiguousData = [
        { id: 1, name: "Item A", category: "fruit" },
        { id: 2, name: "Item B", category: "vegetable" },
        { id: 3, name: "Item C", category: "fruit" },
      ];
      render(
        <Table2
          columns={columns}
          data={nonContiguousData}
          groupBy="category"
          groupCounts={null}
        />,
      );

      expect(screen.queryByText("fruit")).not.toBeInTheDocument();
      expect(screen.queryByText("vegetable")).not.toBeInTheDocument();
      expect(screen.queryByText(/^\(0\)$/)).not.toBeInTheDocument();
      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.getByText("Item B")).toBeInTheDocument();
      expect(screen.getByText("Item C")).toBeInTheDocument();
    });

    it("grup sama muncul di 2 batch terpisah (simulasi terpotong halaman) -- 2 header terpisah, count SAMA dari groupCounts", () => {
      const splitData = [
        { id: 1, name: "Item A", category: "fruit" },
        { id: 2, name: "Item B", category: "vegetable" },
        { id: 3, name: "Item C", category: "fruit" },
      ];
      render(
        <Table2
          columns={columns}
          data={splitData}
          groupBy="category"
          groupCounts={{ fruit: 10, vegetable: 5 }}
        />,
      );

      expect(screen.getAllByText("fruit")).toHaveLength(2);
      // Kedua header count SAMA persis dari groupCounts (bukan dihitung
      // ulang per-batch, yang akan menghasilkan 1 vs 1).
      expect(screen.getAllByText("(10)")).toHaveLength(2);
    });
  });

  // Label header grup harus mengikuti aturan render per-type Cell.jsx, bukan
  // cuma raw value (gap ditemukan lewat pertanyaan user, sebelumnya group
  // label SELALU pakai cabang "string" apapun type kolomnya).
  // persistColumns={false} di SETIAP render blok ini WAJIB -- tanpa itu,
  // Table2 nulis cookie visible-columns asli (jsdom document.cookie, TIDAK
  // di-reset antar test file ini) keyed by window.location.pathname (SAMA
  // utk semua test) -- render dgn kolom terbatas (mis. cuma "due_date") bikin
  // kolom lain di TEST BERIKUTNYA (mis. "qty") ikut ke-hide krn cookie nyasar,
  // gejalanya "row cell" tak muncul walau assertion count-nya sendiri benar.
  describe("grouping label -- type-aware rendering (GroupLabel)", () => {
    it("type date, granularity=day: format locale-aware (PPP), bukan raw ISO string", () => {
      const dateColumns = {
        due_date: { name: "due_date", title: "Due Date", type: "date" },
      };
      render(
        <Table2
          columns={dateColumns}
          data={[
            { id: 1, name: "A", due_date: "2026-01-15" },
            { id: 2, name: "B", due_date: "2026-01-15" },
          ]}
          groupBy="due_date"
          groupGranularity="day"
          groupCounts={{ "2026-01-15": 2 }}
          persistColumns={false}
        />,
      );

      // 3x: label header grup + cell kolom due_date di KEDUA baris (sama
      // tanggal, kolom yg sama dipakai jadi groupBy DAN kolom tampil).
      expect(screen.getAllByText(/January 15th, 2026/)).toHaveLength(3);
      expect(screen.queryByText("2026-01-15")).not.toBeInTheDocument();
    });

    it("type date, granularity default (month) -- 2 baris beda tanggal tapi sebulan sama jadi 1 grup", () => {
      const dateColumns = {
        due_date: { name: "due_date", title: "Due Date", type: "date" },
      };
      render(
        <Table2
          columns={dateColumns}
          data={[
            { id: 1, name: "A", due_date: "2026-01-05" },
            { id: 2, name: "B", due_date: "2026-01-28" },
          ]}
          groupBy="due_date"
          groupCounts={{ "2026-01": 2 }}
          persistColumns={false}
        />,
      );

      expect(screen.getByText("January 2026")).toBeInTheDocument();
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.queryByText(/^\(1\)$/)).not.toBeInTheDocument();
    });

    it("type date, granularity=quarter/half/year: label & run-length grouping benar", () => {
      const dateColumns = {
        due_date: { name: "due_date", title: "Due Date", type: "date" },
      };
      const data = [
        { id: 1, name: "A", due_date: "2026-01-15" },
        { id: 2, name: "B", due_date: "2026-02-20" },
      ];

      const { unmount: unmountQ } = render(
        <Table2
          columns={dateColumns}
          data={data}
          groupBy="due_date"
          groupGranularity="quarter"
          groupCounts={{ "2026-Q1": 2 }}
          persistColumns={false}
        />,
      );
      expect(
        screen.getByText("TR:core.datatable.granularity.quarter 1 2026"),
      ).toBeInTheDocument();
      expect(screen.getByText("(2)")).toBeInTheDocument();
      unmountQ();

      const { unmount: unmountH } = render(
        <Table2
          columns={dateColumns}
          data={data}
          groupBy="due_date"
          groupGranularity="half"
          groupCounts={{ "2026-H1": 2 }}
          persistColumns={false}
        />,
      );
      expect(
        screen.getByText("TR:core.datatable.granularity.half 1 2026"),
      ).toBeInTheDocument();
      unmountH();

      render(
        <Table2
          columns={dateColumns}
          data={data}
          groupBy="due_date"
          groupGranularity="year"
          groupCounts={{ 2026: 2 }}
          persistColumns={false}
        />,
      );
      expect(screen.getByText("2026")).toBeInTheDocument();
    });

    it("type number: format dgn group separator, bukan raw angka", () => {
      const numberColumns = {
        qty: { name: "qty", title: "Qty", type: "number" },
      };
      render(
        <Table2
          columns={numberColumns}
          data={[{ id: 1, name: "A", qty: 1500 }]}
          groupBy="qty"
          groupCounts={{ 1500: 1 }}
          persistColumns={false}
        />,
      );

      // "1,500" muncul 2x: label header grup + cell kolom qty (kolom yg sama
      // dipakai jadi groupBy DAN kolom tampil, sama seperti test relation).
      expect(screen.getAllByText("1,500")).toHaveLength(2);
    });

    it("type number: value 0 (falsy tapi valid) TIDAK dianggap 'tanpa nilai'", () => {
      const numberColumns = {
        qty: { name: "qty", title: "Qty", type: "number" },
      };
      render(
        <Table2
          columns={numberColumns}
          data={[{ id: 1, name: "A", qty: 0 }]}
          groupBy="qty"
          groupCounts={{ 0: 1 }}
          persistColumns={false}
        />,
      );

      expect(screen.getAllByText("0")).toHaveLength(2);
      expect(
        screen.queryByText(/TR:core.datatable.no_group_value/),
      ).not.toBeInTheDocument();
    });

    it("type number dgn groupRange: label rentang 'lower - upper', bucket floor(value/range)*range", () => {
      const numberColumns = {
        amount: { name: "amount", title: "Amount", type: "number" },
      };
      render(
        <Table2
          columns={numberColumns}
          data={[
            { id: 1, name: "A", amount: 150 },
            { id: 2, name: "B", amount: 180 },
            { id: 3, name: "C", amount: 250 },
          ]}
          groupBy="amount"
          groupRange={100}
          groupCounts={{ 100: 2, 200: 1 }}
          persistColumns={false}
        />,
      );

      expect(screen.getByText("100 - 200")).toBeInTheDocument();
      expect(screen.getByText("200 - 300")).toBeInTheDocument();
      // 150 & 180 satu grup (2), 250 grup terpisah (1) -- run-length client
      // pakai floor bucket yg sama dgn backend, bukan raw value per-baris.
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    it("type boolean: label Ya/Tidak (terjemahan), bukan checkbox atau raw true/false; false TIDAK dianggap 'tanpa nilai'", () => {
      const boolColumns = {
        is_active: { name: "is_active", title: "Active", type: "boolean" },
      };
      render(
        <Table2
          columns={boolColumns}
          data={[
            { id: 1, name: "A", is_active: true },
            { id: 2, name: "B", is_active: false },
          ]}
          groupBy="is_active"
          groupCounts={{ true: 1, false: 1 }}
          persistColumns={false}
        />,
      );

      expect(screen.getByText("TR:core.datatable.yes")).toBeInTheDocument();
      expect(screen.getByText("TR:core.datatable.no")).toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/TR:core.datatable.no_group_value/),
      ).not.toBeInTheDocument();
    });

    it("type boolean dengan column.parse -- parse menang atas fallback Ya/Tidak generik", () => {
      const boolColumns = {
        is_active: {
          name: "is_active",
          title: "Active",
          type: "boolean",
          parse: { true: "Aktif", false: "Nonaktif" },
        },
      };
      render(
        <Table2
          columns={boolColumns}
          data={[{ id: 1, name: "A", is_active: true }]}
          groupBy="is_active"
          groupCounts={{ true: 1 }}
          persistColumns={false}
        />,
      );

      expect(screen.getByText("Aktif")).toBeInTheDocument();
      expect(
        screen.queryByText("TR:core.datatable.yes"),
      ).not.toBeInTheDocument();
    });

    it("type formStatus: render BadgeStatus (label terjemahan status.<value>), bukan raw value", () => {
      const statusColumns = {
        status: { name: "status", title: "Status", type: "formStatus" },
      };
      render(
        <Table2
          columns={statusColumns}
          // Cell (row cell, bukan header grup) baca row.appendStatus, BUKAN
          // row[name] -- tanpa field ini Cell crash (appendStatus.length).
          data={[
            { id: 1, name: "A", status: "draft", appendStatus: ["draft"] },
          ]}
          groupBy="status"
          groupCounts={{ draft: 1 }}
          persistColumns={false}
        />,
      );

      // 2x: label header grup (BadgeStatus dari GroupLabel, baca raw value
      // "draft") + cell kolom status (BadgeStatus dari Cell, baca appendStatus).
      expect(screen.getAllByText("TR:status.draft")).toHaveLength(2);
      expect(screen.queryByText("draft")).not.toBeInTheDocument();
    });

    it("type formStatuses (array): render 1 BadgeStatus per elemen; 2 baris beda instance array tapi isi identik tetap 1 grup", () => {
      const statusColumns = {
        status: { name: "status", title: "Status", type: "formStatuses" },
      };
      render(
        <Table2
          columns={statusColumns}
          data={[
            {
              id: 1,
              name: "A",
              status: ["approved", "pending"],
              appendStatus: ["approved", "pending"],
            },
            // Instance array BARU, isi & URUTAN identik row #1 -- harus tetap
            // 1 grup (run-length pakai JSON.stringify, bukan referensi array
            // mentah yg SELALU beda -- regresi sama persis dgn object relasi).
            {
              id: 2,
              name: "B",
              status: ["approved", "pending"],
              appendStatus: ["approved", "pending"],
            },
          ]}
          groupBy="status"
          groupCounts={{ '["approved","pending"]': 2 }}
          persistColumns={false}
        />,
      );

      // 1 grup (2), BUKAN 2 grup terpisah (1 & 1).
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.queryByText("(1)")).not.toBeInTheDocument();
      // 2 badge per instance (header grup + 2x cell kolom status) = 6 total.
      expect(screen.getAllByText("TR:status.approved")).toHaveLength(3);
      expect(screen.getAllByText("TR:status.pending")).toHaveLength(3);
    });

    it("type relation: render via convertTemplateLink (nama relasi), bukan [object Object]", () => {
      const relationColumns = {
        customer: { name: "customer", title: "Customer", type: "relation" },
      };
      const customerA = { id: 10, name: "Acme Corp", templateLink: ":name" };
      render(
        <Table2
          columns={relationColumns}
          data={[
            { id: 1, name: "A", customer: customerA },
            { id: 2, name: "B", customer: { ...customerA } },
          ]}
          groupBy="customer"
          groupCounts={{ 10: 2 }}
          persistColumns={false}
        />,
      );

      // 2 baris beda instance object (spread) tapi id SAMA -- harus jadi SATU
      // grup (run-length key pakai primaryKey, bukan referensi object) --
      // kalau salah (2 grup terpisah), akan muncul 2x "(1)" alih-alih "(2)".
      // "Acme Corp" muncul 3x: 1 label header grup + 2 cell kolom customer
      // per baris (kolom yg sama dipakai jadi groupBy DAN kolom tampil).
      expect(screen.getAllByText("Acme Corp")).toHaveLength(3);
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.queryByText("(1)")).not.toBeInTheDocument();
    });

    it("type relation: value null (tak ada relasi tertaut) dianggap 'tanpa nilai'", () => {
      const relationColumns = {
        customer: { name: "customer", title: "Customer", type: "relation" },
      };
      render(
        <Table2
          columns={relationColumns}
          data={[{ id: 1, name: "A", customer: null }]}
          groupBy="customer"
          groupCounts={{ null: 1 }}
          persistColumns={false}
        />,
      );

      expect(
        screen.getByText("TR:core.datatable.no_group_value"),
      ).toBeInTheDocument();
    });

    it("type html: render HTML sesuai Cell (dangerouslySetInnerHTML), bukan teks mentah", () => {
      const htmlColumns = {
        note: { name: "note", title: "Note", type: "html" },
      };
      render(
        <Table2
          columns={htmlColumns}
          data={[{ id: 1, name: "A", note: "<b>Penting</b>" }]}
          groupBy="note"
          groupCounts={{ "<b>Penting</b>": 1 }}
          persistColumns={false}
        />,
      );

      // 2x: label header grup + cell kolom note (kolom yg sama dipakai
      // jadi groupBy DAN kolom tampil, sama seperti test number/relation).
      const bolds = screen.getAllByText("Penting");
      expect(bolds).toHaveLength(2);
      bolds.forEach((bold) => expect(bold.tagName).toBe("B"));
    });
  });
});
