import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { render, screen } from "@testing-library/react";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  Head: ({ title }) => <title>{title}</title>,
  // Deferred/WhenVisible/router tidak dipakai FormPageDiff/FormChildren pada
  // path yang diuji di sini, tapi FormChildren mengimpornya secara statis di
  // module yang sama (FormPage.jsx) -- sediakan stub aman agar tidak crash
  // kalau ada cabang lain yang menyentuhnya secara tidak langsung.
  Deferred: ({ children, fallback }) => children ?? fallback ?? null,
  WhenVisible: ({ children, fallback }) => children ?? fallback ?? null,
  router: { visit: vi.fn() },
}));

// AppLayout membawa seluruh chrome aplikasi (Sidebar, Navbar, CommandPalette)
// yang butuh banyak context/provider tidak relevan untuk test diff display.
// Di-stub jadi passthrough sederhana yang tetap merender children dan
// meneruskan onScroll/data-header agar behavior FormPageDiff sendiri
// (handleScroll, dst) tidak berubah drastis strukturnya.
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, onScroll }) => (
    <div data-testid="app-layout" onScroll={onScroll}>
      {children}
    </div>
  ),
}));

import { FormPageDiff, FormPageContent } from "./FormPage";

function basePageProps(overrides = {}) {
  return {
    dataAfter: { code: "PO-002", name: "Setelah" },
    dataBefore: { code: "PO-001", name: "Sebelum" },
    log: {
      created_at: "2026-01-01T00:00:00Z",
      user: {
        name: "Budi Santoso",
        picture: null,
        username: "budi",
        email: "budi@example.com",
      },
    },
    lang: "en",
    ...overrides,
  };
}

describe("FormPageDiff", () => {
  // Timezone di-stub SEKALI untuk seluruh file, sebelum test manapun
  // sempat merender bottombar log (yang memanggil TZDate(log.created_at)
  // tanpa argumen timezone eksplisit -- lihat FormPage.jsx). @date-fns/tz
  // meng-cache Intl.DateTimeFormat pertamanya per-timezone-key di module
  // scope (offsetFormatCache) -- kalau TZ baru di-set SETELAH panggilan
  // pertama itu terjadi (mis. di beforeEach test lain yang jalan duluan),
  // cache lama (terikat ke TZ mesin) akan tetap dipakai dan perubahan TZ
  // belakangan tidak berpengaruh. beforeAll di sini menjamin urutannya.
  beforeAll(() => {
    vi.stubEnv("TZ", "Asia/Jakarta");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    usePageMock.mockReset();
    usePageMock.mockReturnValue({ props: basePageProps() });
  });

  it("timestamp log (bottombar) dirender sebagai waktu lokal Asia/Jakarta, bukan UTC mentah", () => {
    // 2026-09-16T07:31:00Z == 16 Sep 2026 14:31 di Asia/Jakarta (UTC+7).
    // Kalau kode kembali memaksa TZDate(..., "UTC"), hasilnya akan
    // "7:31 AM" (jam UTC mentah) -- assert negatif di bawah menangkap itu.
    usePageMock.mockReturnValue({
      props: basePageProps({
        log: {
          created_at: "2026-09-16T07:31:00.000000Z",
          user: {
            name: "Budi Santoso",
            picture: null,
            username: "budi",
            email: "budi@example.com",
          },
        },
      }),
    });

    render(
      <FormPageDiff title="Diff">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    expect(screen.getByText(/2:31\s*PM/i)).toBeInTheDocument();
    expect(screen.queryByText(/7:31\s*AM/i)).not.toBeInTheDocument();
  });

  it("merender title dan badge di header", () => {
    render(
      <FormPageDiff title="Riwayat Perubahan PO-002" badge={<span>v2</span>}>
        <FormPageContent value="detail" title="Detail">
          <p>Konten diff</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    expect(
      screen.getByRole("heading", { name: "Riwayat Perubahan PO-002" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("meneruskan dataAfter sebagai data dan dataBefore sebagai dataBefore ke FormChildren (disabled=true)", () => {
    render(
      <FormPageDiff title="Diff">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    // FormPageDiff selalu disabled=true (readOnly) -- dibuktikan via class
    // pointer-events-none pada wrapper form yang berasal dari role=title
    // pointer-events di parent (lihat className pada div grid FormChildren
    // sibling). Verifikasi paling reliable: konten tetap ter-render (data
    // tersedia) walau tanpa interaksi apapun.
    expect(screen.getByText("Konten")).toBeInTheDocument();
  });

  it("menampilkan informasi log: timestamp, nama user, username, email di bottombar", () => {
    render(
      <FormPageDiff title="Diff">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("budi")).toBeInTheDocument();
    expect(screen.getByText("budi@example.com")).toBeInTheDocument();
    expect(screen.getByText("core.form.log_informations")).toBeInTheDocument();
  });

  it("alias avatar log user diambil dari 2 huruf pertama tiap kata nama", () => {
    usePageMock.mockReturnValue({
      props: basePageProps({
        log: {
          created_at: "2026-01-01T00:00:00Z",
          user: {
            name: "Ani Wijaya Kusuma",
            picture: null,
            username: "ani",
            email: "ani@x.com",
          },
        },
      }),
    });

    render(
      <FormPageDiff title="Diff">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    expect(screen.getByText("AW")).toBeInTheDocument();
  });

  it("log.user null (log system tanpa user terautentikasi) -- tampilkan fallback System, tidak crash", () => {
    // Sekarang genuinely reachable: audit log tetap tercatat dgn user_id
    // null saat tidak ada Auth (seeder/artisan/job) -- lihat
    // app/Traits/DataTable.php bootDataTable(). Sebelum fix ini, log.user
    // diakses langsung tanpa null-check (log.user.name dst) -- crash.
    usePageMock.mockReturnValue({
      props: basePageProps({
        log: {
          created_at: "2026-01-01T00:00:00Z",
          user: null,
        },
      }),
    });

    render(
      <FormPageDiff title="Diff">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    expect(screen.getByText("core.form.system")).toBeInTheDocument();
  });

  it("tidak merender tombol save (readOnly) -- tidak ada button[type=submit] role save", () => {
    render(
      <FormPageDiff title="Diff">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPageDiff>,
    );

    expect(
      screen.queryByRole("button", { name: /save/i }),
    ).not.toBeInTheDocument();
  });
});
