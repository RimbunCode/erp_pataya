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
import userEvent from "@testing-library/user-event";

// t harus stabil -- Comments.jsx tidak punya useEffect ber-dependency `t`,
// tapi CommentBody juga menggunakan `t` dan pola stabil ini konsisten dgn
// contoh referensi (Notifications.rtl.test.jsx) dan aman terhadap re-render.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
const routerPost = vi.fn();
const routerPut = vi.fn();
const routerDelete = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: {
    post: (...a) => routerPost(...a),
    put: (...a) => routerPut(...a),
    delete: (...a) => routerDelete(...a),
  },
  Deferred: ({ children }) => {
    // Stub sederhana: anggap data selalu "siap" (props sudah ada di usePage mock),
    // langsung render children -- fallback loading tidak reliabel diuji tanpa
    // implementasi Inertia asli.
    return children;
  },
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...a) => toastError(...a) },
}));

// TiptapEditor adalah dependency berat (ProseMirror) yang tidak reliable
// di jsdom -- stub dengan textarea sederhana yang expose ref imperative API
// minimal (getHTML/isEmpty) yang dipakai Comments.jsx.
vi.mock("@/Components/TiptapEditor", () => ({
  default: React.forwardRef(({ value, onValueChange, placeholder }, ref) => {
    // getHTML() harus mencerminkan draft TERAKHIR yang diketik user di sesi
    // dialog ini, bukan `value` prop awal (yang untuk mode edit berisi
    // comment_json existing dan tidak berubah walau user mengetik ulang).
    const draftRef = React.useRef(value ? "<p>existing</p>" : "");
    React.useImperativeHandle(ref, () => ({
      getHTML: () => draftRef.current,
      isEmpty: !draftRef.current,
    }));
    return (
      <textarea
        data-testid="tiptap-stub"
        placeholder={placeholder}
        onChange={(e) => {
          draftRef.current = e.target.value ? `<p>${e.target.value}</p>` : "";
          onValueChange?.({ text: e.target.value });
        }}
      />
    );
  }),
}));

import React from "react";

window.route = (name, id) => (id ? `${name}/${id}` : name);

import Comments from "./Comments";

const baseLog = {
  id: 1,
  type: "comment",
  activity: "Halo dunia",
  user: { id: 1, name: "Budi Santoso", picture: null },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  comment_json: { text: "Halo dunia" },
  data_after: null,
};

const logActivity = {
  id: 2,
  type: "log",
  activity: { en: ":user updated the record" },
  user: { id: 2, name: "Other User" },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  comment_json: null,
  data_after: { field: "value" },
};

function setPageProps({ logs = [baseLog], currentUserId = 1 } = {}) {
  usePageMock.mockReturnValue({
    props: {
      logs,
      lang: "en",
      auth: { user: { id: currentUserId } },
    },
  });
}

beforeEach(() => {
  axiosGet.mockReset();
  routerPost.mockReset();
  routerPut.mockReset();
  routerDelete.mockReset();
  toastError.mockReset();
  delete window.location;
  window.location = new URL("https://example.test/todos/5?tab=activity");
  setPageProps();
});

describe("Comments", () => {
  // Timezone di-stub SEKALI untuk seluruh file, sebelum test manapun sempat
  // merender timestamp komentar (yang memanggil TZDate(created_at) tanpa
  // argumen timezone eksplisit). @date-fns/tz meng-cache Intl.DateTimeFormat
  // pertamanya per-timezone-key di module scope (offsetFormatCache) -- kalau
  // TZ baru di-set SETELAH panggilan pertama itu terjadi, cache lama (terikat
  // ke TZ mesin) tetap dipakai dan perubahan TZ belakangan tidak berpengaruh.
  // beforeAll di sini menjamin urutannya (jalan sebelum semua beforeEach/it).
  beforeAll(() => {
    vi.stubEnv("TZ", "Asia/Jakarta");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("timestamp komentar dirender sebagai waktu lokal Asia/Jakarta, bukan UTC mentah", () => {
    // 2026-09-16T07:31:00Z == 16 Sep 2026 14:31 di Asia/Jakarta (UTC+7).
    // Kalau kode kembali memaksa TZDate(..., "UTC"), hasilnya "7:31 AM".
    setPageProps({
      logs: [{ ...baseLog, created_at: "2026-09-16T07:31:00.000000Z" }],
    });
    render(<Comments />);

    expect(screen.getByText(/2:31\s*PM/i)).toBeInTheDocument();
    expect(screen.queryByText(/7:31\s*AM/i)).not.toBeInTheDocument();
  });

  it("menampilkan judul activity dan tombol tambah komentar", () => {
    render(<Comments />);
    expect(screen.getByText("TR:core.form.activity")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /TR:core.form.add_comment/ }),
    ).toBeInTheDocument();
  });

  it("merender komentar dengan nama user dan isi activity", () => {
    render(<Comments />);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Halo dunia")).toBeInTheDocument();
  });

  it("merender log non-comment dengan placeholder :user diganti link nama user", () => {
    setPageProps({ logs: [logActivity] });
    render(<Comments />);
    // activity[lang] diganti :user -> <a>Other User</a>, dirender via dangerouslySetInnerHTML.
    expect(screen.getByText("Other User")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "TR:core.form.show_diff" }),
    ).toBeInTheDocument();
  });

  it("tombol edit/hapus komentar tidak muncul untuk bukan pemilik komentar", () => {
    setPageProps({ logs: [baseLog], currentUserId: 999 });
    render(<Comments />);
    // Tombol edit/hapus adalah icon-only button tanpa accessible name teks;
    // pastikan hanya tombol "add comment" yang ada (bukan tombol lain di kartu komentar).
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("TR:core.form.add_comment");
  });

  it("tombol edit/hapus komentar muncul untuk pemilik komentar", () => {
    render(<Comments />);
    const buttons = screen.getAllByRole("button");
    // add_comment + edit + delete = 3
    expect(buttons).toHaveLength(3);
  });

  it("klik tombol tambah komentar membuka dialog", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Comments />);

    await user.click(
      screen.getByRole("button", { name: /TR:core.form.add_comment/ }),
    );

    expect(screen.getByTestId("tiptap-stub")).toBeInTheDocument();
    // Dialog title untuk mode add sama teksnya dgn tombol trigger.
    expect(
      screen.getAllByText("TR:core.form.add_comment").length,
    ).toBeGreaterThan(1);
  });

  it("tombol kirim disabled saat editor kosong, aktif setelah mengetik", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Comments />);

    await user.click(
      screen.getByRole("button", { name: /TR:core.form.add_comment/ }),
    );

    const sendButton = await screen.findByRole("button", {
      name: "TR:core.form.comment_send",
    });
    expect(sendButton).toBeDisabled();

    await user.type(screen.getByTestId("tiptap-stub"), "Komentar baru");
    expect(sendButton).not.toBeDisabled();
  });

  it("submit komentar baru memanggil router.post ke path .../comment", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Comments />);

    await user.click(
      screen.getByRole("button", { name: /TR:core.form.add_comment/ }),
    );
    await user.type(screen.getByTestId("tiptap-stub"), "Komentar baru");
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.comment_send" }),
    );

    expect(routerPost).toHaveBeenCalledWith(
      "/todos/5/comment?tab=activity",
      expect.objectContaining({ comment: "<p>Komentar baru</p>" }),
      expect.objectContaining({ reset: ["logs"] }),
    );
  });

  it("klik edit membuka dialog dengan judul edit dan submit memanggil router.put", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Comments />);

    const editButton = screen.getAllByRole("button")[1];
    await user.click(editButton);

    expect(
      await screen.findByText("TR:core.form.edit_comment"),
    ).toBeInTheDocument();

    const updateButton = screen.getByRole("button", {
      name: "TR:core.form.comment_update",
    });
    // comment_json sudah terisi dari log yang di-edit -> tombol update tidak disabled.
    expect(updateButton).not.toBeDisabled();

    await user.click(updateButton);

    expect(routerPut).toHaveBeenCalledWith(
      "/todos/5/comment/1?tab=activity",
      expect.objectContaining({ comment: "<p>existing</p>" }),
      expect.objectContaining({ reset: ["logs"] }),
    );
  });

  it("klik hapus (trash) memanggil router.delete ke path komentar", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Comments />);

    const deleteButton = screen.getAllByRole("button")[2];
    await user.click(deleteButton);

    expect(routerDelete).toHaveBeenCalledWith(
      "/todos/5/comment/1?tab=activity",
      expect.objectContaining({ reset: ["logs"] }),
    );
  });

  it("klik cancel menutup dialog tanpa memanggil router", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Comments />);

    await user.click(
      screen.getByRole("button", { name: /TR:core.form.add_comment/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    );

    expect(routerPost).not.toHaveBeenCalled();
  });
});
