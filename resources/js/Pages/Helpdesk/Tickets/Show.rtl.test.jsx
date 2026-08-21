import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil (module-level, bukan arrow function baru tiap render) --
// TicketResponseDiff membangun array `fields` yang memanggil t() untuk tiap
// label di setiap render; instabilitas t tidak memicu bug di sini tapi
// mengikuti konvensi test lain di repo ini untuk konsistensi.
const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerPutSpy = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: {
    put: (...a) => routerPutSpy(...a),
  },
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

// FormPage dan FormPageDialog dikompos LANGSUNG sebagai komponen (bukan
// hook) oleh Show.jsx -- stub sebagai wrapper render children/props agar
// fokus test di logic UNIK Show.jsx, bukan orkestrasi FormPage (sudah
// dites terpisah di FormPage.rtl.test.jsx / FormPageDialog.rtl.test.jsx).
const formPageProps = vi.fn();
const formPageDialogProps = vi.fn();
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ children, controls, name, isCreate, ...rest }) => {
    formPageProps({ name, isCreate, ...rest });
    return (
      <div data-testid="stub-form-page">
        <div data-testid="form-page-controls">
          {typeof controls === "function" ? controls() : controls}
        </div>
        {children}
      </div>
    );
  },
  FormPageDialog: ({ children, ...rest }) => {
    formPageDialogProps(rest);
    return <div data-testid="stub-form-page-dialog">{children}</div>;
  },
}));

// Form.jsx (main ticket form) sudah punya test sendiri di
// Form.rtl.test.jsx -- stub sebagai black-box di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// ResponseForm.jsx hanyalah re-export dari ./Form (lihat source: `export
// { default } from "./Form";`), jadi sama sekali bukan komponen terpisah --
// stub sebagai black-box juga, bukan retest logic Form.jsx.
vi.mock("./ResponseForm", () => ({
  default: () => <div data-testid="stub-response-form" />,
}));

import Show from "./Show";

function baseTicket(overrides = {}) {
  return {
    id: 1,
    status: "in_progress",
    responses: [],
    ...overrides,
  };
}

const renderShow = (props) => render(<Show {...props} />);

describe("Helpdesk Tickets Show", () => {
  beforeEach(() => {
    formPageProps.mockClear();
    formPageDialogProps.mockClear();
    routerPutSpy.mockReset();
    usePageMock.mockReturnValue({ props: { auth: { user: { id: 1 } } } });
  });

  describe("render dasar & mode create/edit", () => {
    it("mode create (ticket null): FormPage menerima isCreate=true, tidak merender section responses/dialog", () => {
      renderShow({ ticket: null, defaultData: undefined });

      expect(formPageProps).toHaveBeenCalledWith(
        expect.objectContaining({ name: "ticket", isCreate: true }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByText("helpdesk.ticket.responses.title"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("stub-form-page-dialog"),
      ).not.toBeInTheDocument();
    });

    it("mode edit (ticket ada): FormPage menerima isCreate=false, section responses & dialog update dirender", () => {
      renderShow({ ticket: baseTicket(), defaultData: { id: 1 } });

      expect(formPageProps).toHaveBeenCalledWith(
        expect.objectContaining({ name: "ticket", isCreate: false }),
      );
      expect(
        screen.getByText("helpdesk.ticket.responses.title"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("stub-form-page-dialog")).toBeInTheDocument();
    });

    it("FormPage menerima disabled dan deleteable=false", () => {
      renderShow({ ticket: baseTicket() });

      expect(formPageProps).toHaveBeenCalledWith(
        expect.objectContaining({ disabled: true, deleteable: false }),
      );
    });
  });

  describe("controls: tombol update & mark done", () => {
    it("ticket null: controls() mengembalikan null (tidak ada tombol)", () => {
      renderShow({ ticket: null });

      const controlsBox = screen.getByTestId("form-page-controls");
      expect(controlsBox).toBeEmptyDOMElement();
    });

    it("ticket status done: controls() mengembalikan null (tidak ada tombol)", () => {
      renderShow({ ticket: baseTicket({ status: "done" }) });

      const controlsBox = screen.getByTestId("form-page-controls");
      expect(controlsBox).toBeEmptyDOMElement();
    });

    it("ticket ada & belum done: menampilkan tombol update_ticket dan mark_done", () => {
      renderShow({ ticket: baseTicket({ status: "in_progress" }) });

      expect(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.update_ticket",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.mark_done",
        }),
      ).toBeInTheDocument();
    });

    it("klik tombol mark_done membuka AlertDialog konfirmasi", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({ ticket: baseTicket() });

      expect(
        screen.queryByText("helpdesk.ticket.mark_done_dialog.title"),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.mark_done",
        }),
      );

      expect(
        screen.getByText("helpdesk.ticket.mark_done_dialog.title"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("helpdesk.ticket.mark_done_dialog.description"),
      ).toBeInTheDocument();
    });
  });

  describe("AlertDialog mark done: konfirmasi/batal/action", () => {
    it("klik cancel pada AlertDialog menutup dialog tanpa memanggil router.put", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({ ticket: baseTicket() });

      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.mark_done",
        }),
      );
      await user.click(
        screen.getByRole("button", { name: "core.form.cancel" }),
      );

      expect(
        screen.queryByText("helpdesk.ticket.mark_done_dialog.title"),
      ).not.toBeInTheDocument();
      expect(routerPutSpy).not.toHaveBeenCalled();
    });

    it("klik confirm memanggil router.put ke route tickets.markDone dengan ticket.id", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({ ticket: baseTicket({ id: 42 }) });

      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.mark_done",
        }),
      );
      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.mark_done_dialog.confirm",
        }),
      );

      expect(routerPutSpy).toHaveBeenCalledTimes(1);
      const [calledPath, payload] = routerPutSpy.mock.calls[0];
      expect(calledPath).toBe("tickets.markDone/42");
      expect(payload).toEqual({});
    });

    it("onFinish menutup dialog setelah router.put selesai", async () => {
      const user = userEvent.setup({ delay: null });
      routerPutSpy.mockImplementation((_path, _data, options) => {
        options.onFinish();
      });
      renderShow({ ticket: baseTicket() });

      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.mark_done",
        }),
      );
      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.mark_done_dialog.confirm",
        }),
      );

      expect(
        screen.queryByText("helpdesk.ticket.mark_done_dialog.title"),
      ).not.toBeInTheDocument();
    });

    it("router.put dipanggil dengan option onFinish sebagai callback (kontrak loading state)", async () => {
      const user = userEvent.setup({ delay: null });
      // Radix AlertDialogAction menutup dialog otomatis begitu diklik --
      // state `loading`/label "..." di source tidak pernah sempat terlihat
      // di DOM karena AlertDialogContent sudah unmount duluan. Assertion
      // yang reliable di sini adalah KONTRAK pemanggilan router.put: opsi
      // onFinish disediakan (dipakai source utk setLoading(false) dan
      // setMarkDoneOpen(false)), bukan visibilitas DOM sesaat.
      renderShow({ ticket: baseTicket() });

      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.mark_done",
        }),
      );
      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.mark_done_dialog.confirm",
        }),
      );

      expect(routerPutSpy).toHaveBeenCalledTimes(1);
      const [, , options] = routerPutSpy.mock.calls[0];
      expect(typeof options.onFinish).toBe("function");
    });
  });

  describe("update ticket dialog (FormPageDialog)", () => {
    it("klik tombol update_ticket tidak crash (memicu updateDialogRef.current.open())", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({ ticket: baseTicket() });

      // FormPageDialog di-stub sehingga ref.open() adalah no-op (stub tidak
      // forward ref) -- assertion utama di sini adalah klik tidak melempar
      // exception meskipun ref kosong (optional chaining `?.open()` di source).
      await user.click(
        screen.getByRole("button", {
          name: "helpdesk.ticket.actions.update_ticket",
        }),
      );

      expect(screen.getByTestId("stub-form-page-dialog")).toBeInTheDocument();
    });

    it("FormPageDialog menerima routeName, method, dan routeParams=ticket.id yang benar", () => {
      renderShow({ ticket: baseTicket({ id: 99 }) });

      expect(formPageDialogProps).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "put",
          routeName: "tickets.updateTicket",
          routeParams: 99,
          name: "ticket_response",
          ignoreDraft: true,
        }),
      );
    });

    it("defaultValue FormPageDialog berisi field ticket plus content dari lastResponseByMe jika responder = user saat ini", () => {
      usePageMock.mockReturnValue({ props: { auth: { user: { id: 5 } } } });
      const ticket = baseTicket({
        subject: "Bug login",
        responses: [
          {
            id: 10,
            user_id: 5,
            content: "<p>balasan saya</p>",
            content_json: { type: "doc" },
          },
        ],
      });
      renderShow({ ticket });

      const { defaultValue } = formPageDialogProps.mock.calls.at(-1)[0];
      expect(defaultValue).toEqual(
        expect.objectContaining({
          subject: "Bug login",
          content: "<p>balasan saya</p>",
          content_json: { type: "doc" },
        }),
      );
    });

    it("defaultValue content null jika response terakhir BUKAN dari user saat ini", () => {
      usePageMock.mockReturnValue({ props: { auth: { user: { id: 5 } } } });
      const ticket = baseTicket({
        responses: [
          {
            id: 10,
            user_id: 999,
            content: "<p>balasan orang lain</p>",
            content_json: { type: "doc" },
          },
        ],
      });
      renderShow({ ticket });

      const { defaultValue } = formPageDialogProps.mock.calls.at(-1)[0];
      expect(defaultValue.content).toBeNull();
      expect(defaultValue.content_json).toBeNull();
    });
  });

  describe("TicketResponseList & TicketResponseDiff", () => {
    it("responses kosong: menampilkan pesan empty state", () => {
      renderShow({ ticket: baseTicket({ responses: [] }) });

      expect(
        screen.getByText("helpdesk.ticket.responses.empty"),
      ).toBeInTheDocument();
    });

    it("response tunggal (tanpa previous): menampilkan semua field non-kosong sebagai daftar (bukan diff)", () => {
      const ticket = baseTicket({
        responses: [
          {
            id: 1,
            user: { name: "Agent A" },
            created_at: "2026-08-20T10:00:00Z",
            status: "open",
            progress: 20,
            type: "task",
            priority: "medium",
            subject: "Subjek awal",
            assign_to_id: null,
            assign_to: null,
            start_date: null,
            due_date: null,
            content: null,
          },
        ],
      });
      const { container } = renderShow({ ticket });

      // Scope ke blok diff (.mt-2.space-y-0.5) -- badge status/progress di
      // header card memakai teks yang sama (mis. status "open") sehingga
      // query tanpa scope match >1 elemen.
      const diffBlock = within(container.querySelector(".mt-2.space-y-0\\.5"));

      expect(
        diffBlock.getByText("helpdesk.ticket.type.options.task"),
      ).toBeInTheDocument();
      expect(
        diffBlock.getByText("helpdesk.ticket.priority.options.medium"),
      ).toBeInTheDocument();
      expect(
        diffBlock.getByText("helpdesk.ticket.status.options.open"),
      ).toBeInTheDocument();
      expect(diffBlock.getByText("20%")).toBeInTheDocument();
      expect(diffBlock.getByText("Subjek awal")).toBeInTheDocument();
      // assign_to_id null -> format menghasilkan "-" -> field disembunyikan
      // (tidak dirender karena val === "-" di-filter oleh `if (!val ...) return null`).
      expect(
        diffBlock.queryByText("helpdesk.ticket.columns.assign_to"),
      ).not.toBeInTheDocument();
    });

    it("dua response (current vs previous): hanya field yang BERUBAH ditampilkan sebagai diff garis-tengah -> nilai baru", () => {
      const older = {
        id: 1,
        user: { name: "Agent A" },
        created_at: "2026-08-19T09:00:00Z",
        status: "open",
        progress: 10,
        type: "task",
        priority: "low",
        subject: "Subjek sama",
        assign_to_id: null,
        assign_to: null,
        start_date: null,
        due_date: null,
        content: null,
      };
      const newer = {
        ...older,
        id: 2,
        created_at: "2026-08-20T09:00:00Z",
        status: "in_progress",
        progress: 40,
        priority: "high",
      };
      // responses diurutkan DESC (terbaru index 0), previous = responses[i+1]
      const ticket = baseTicket({ responses: [newer, older] });
      const { container } = renderShow({ ticket });

      // Card pertama (index 0) = response `newer` -- scope ke blok diff-nya
      // saja, karena badge header card lain (mis. status "open" milik
      // `older`) memakai teks yang sama.
      const newerDiffBlock = within(
        container.querySelectorAll(".mt-2.space-y-0\\.5")[0],
      );

      // status berubah open -> in_progress: tampil sebagai diff (dari dicoret, ke ditebalkan)
      expect(
        newerDiffBlock.getByText("helpdesk.ticket.status.options.open"),
      ).toBeInTheDocument();
      expect(
        newerDiffBlock.getByText("helpdesk.ticket.status.options.in_progress"),
      ).toBeInTheDocument();

      // priority berubah low -> high
      expect(
        newerDiffBlock.getByText("helpdesk.ticket.priority.options.low"),
      ).toBeInTheDocument();
      expect(
        newerDiffBlock.getByText("helpdesk.ticket.priority.options.high"),
      ).toBeInTheDocument();

      // progress berubah 10% -> 40%
      expect(newerDiffBlock.getByText("10%")).toBeInTheDocument();
      expect(newerDiffBlock.getByText("40%")).toBeInTheDocument();

      // subject TIDAK berubah -> tidak ditampilkan sebagai diff sama sekali
      expect(
        newerDiffBlock.queryByText("Subjek sama"),
      ).not.toBeInTheDocument();

      // type TIDAK berubah -> tidak ditampilkan
      expect(
        newerDiffBlock.queryByText("helpdesk.ticket.type.options.task"),
      ).not.toBeInTheDocument();
    });

    it("tidak ada field yang berubah antar dua response: TicketResponseDiff tidak merender apa pun", () => {
      const same = {
        id: 1,
        user: { name: "Agent A" },
        created_at: "2026-08-19T09:00:00Z",
        status: "open",
        progress: 10,
        type: "task",
        priority: "low",
        subject: "Sama persis",
        assign_to_id: null,
        assign_to: null,
        start_date: null,
        due_date: null,
        content: null,
      };
      const identicalNewer = { ...same, id: 2 };
      const ticket = baseTicket({ responses: [identicalNewer, same] });
      const { container } = renderShow({ ticket });

      // Card pertama (index 0) = response `identicalNewer`, dibandingkan ke
      // `same` (previous) -- semua field identik jadi TicketResponseDiff
      // return null (tidak merender div `.mt-2.space-y-0.5` sama sekali,
      // bukan cuma kosong). Card kedua (response `same`, tanpa previous)
      // TETAP merender field-list-nya sendiri -- karena itu assertion
      // dilakukan dengan menghitung jumlah blok diff yang ada persis 1
      // (milik card kedua), bukan queryByText tanpa scope.
      const diffBlocks = container.querySelectorAll(".mt-2.space-y-0\\.5");
      expect(diffBlocks).toHaveLength(1);
      expect(
        within(diffBlocks[0]).getByText("helpdesk.ticket.columns.status"),
      ).toBeInTheDocument();
    });

    it("assign_to_id berubah: diff dibandingkan berdasar assign_to_id (bukan objek assign_to), label pakai assign_to.name", () => {
      const older = {
        id: 1,
        user: { name: "Agent A" },
        created_at: "2026-08-19T09:00:00Z",
        status: "open",
        progress: 10,
        type: "task",
        priority: "low",
        subject: "S",
        assign_to_id: 5,
        assign_to: { name: "User Lama" },
        start_date: null,
        due_date: null,
        content: null,
      };
      const newer = {
        ...older,
        id: 2,
        assign_to_id: 8,
        assign_to: { name: "User Baru" },
      };
      const ticket = baseTicket({ responses: [newer, older] });
      const { container } = renderShow({ ticket });

      // "User Lama" muncul di DUA tempat: diff row card `newer` (nilai
      // "from") DAN field-list card `older` (response terlama, tidak
      // punya previous, jadi merender field assign_to apa adanya) --
      // scope ke diff block card pertama supaya spesifik ke assertion diff.
      const newerDiffBlock = within(
        container.querySelectorAll(".mt-2.space-y-0\\.5")[0],
      );
      expect(newerDiffBlock.getByText("User Lama")).toBeInTheDocument();
      expect(newerDiffBlock.getByText("User Baru")).toBeInTheDocument();
    });

    it("start_date/due_date diformat sebagai tanggal lokal saat ada nilainya", () => {
      const ticket = baseTicket({
        responses: [
          {
            id: 1,
            user: { name: "Agent A" },
            created_at: "2026-08-20T09:00:00Z",
            status: "open",
            progress: 0,
            type: "task",
            priority: "low",
            subject: "S",
            assign_to_id: null,
            assign_to: null,
            start_date: "2026-08-01T00:00:00Z",
            due_date: "2026-08-15T00:00:00Z",
            content: null,
          },
        ],
      });
      renderShow({ ticket });

      const expectedStart = new Date(
        "2026-08-01T00:00:00Z",
      ).toLocaleDateString();
      const expectedDue = new Date(
        "2026-08-15T00:00:00Z",
      ).toLocaleDateString();
      expect(screen.getByText(expectedStart)).toBeInTheDocument();
      expect(screen.getByText(expectedDue)).toBeInTheDocument();
    });

    it("response.content dirender via sanitizeHTML (dangerouslySetInnerHTML), tag berbahaya seperti <script> dihapus", () => {
      const ticket = baseTicket({
        responses: [
          {
            id: 1,
            user: { name: "Agent A" },
            created_at: "2026-08-20T09:00:00Z",
            status: "open",
            progress: 0,
            type: "task",
            priority: "low",
            subject: "S",
            assign_to_id: null,
            assign_to: null,
            start_date: null,
            due_date: null,
            content:
              '<p>Halo <strong>dunia</strong></p><script>alert(1)</script>',
          },
        ],
      });
      const { container } = renderShow({ ticket });

      expect(screen.getByText("dunia")).toBeInTheDocument();
      expect(container.querySelector("script")).not.toBeInTheDocument();
      expect(container.innerHTML).not.toContain("alert(1)");
    });

    it("response.content kosong (falsy): tidak merender blok konten HTML", () => {
      const ticket = baseTicket({
        responses: [
          {
            id: 1,
            user: { name: "Agent A" },
            created_at: "2026-08-20T09:00:00Z",
            status: "open",
            progress: 0,
            type: "task",
            priority: "low",
            subject: "S",
            assign_to_id: null,
            assign_to: null,
            start_date: null,
            due_date: null,
            content: null,
          },
        ],
      });
      const { container } = renderShow({ ticket });

      expect(container.querySelector(".prose")).not.toBeInTheDocument();
    });

    it("menampilkan nama user dan status/progress badge tiap response", () => {
      const ticket = baseTicket({
        responses: [
          {
            id: 1,
            user: { name: "Jane Doe" },
            created_at: "2026-08-20T09:00:00Z",
            status: "resolved",
            progress: 75,
            type: "task",
            priority: "low",
            subject: "S",
            assign_to_id: null,
            assign_to: null,
            start_date: null,
            due_date: null,
            content: null,
          },
        ],
      });
      const { container } = renderShow({ ticket });

      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      // Badge header (bg-secondary) -- teks status juga muncul di blok
      // field-list di bawahnya (response tunggal tanpa previous merender
      // semua field non-kosong), jadi scope ke badge secara spesifik.
      const badge = container.querySelector(".bg-secondary");
      expect(badge).toHaveTextContent(
        "helpdesk.ticket.status.options.resolved",
      );
      // Progress juga muncul dua kali (badge header "75%" dari dua text
      // node terpisah `{progress}%`, dan blok field-list "75%" sebagai satu
      // string) -- assert count-nya alih-alih getByText tunggal.
      expect(screen.getAllByText("75%")).toHaveLength(2);
    });

    it("multiple response dirender sebagai beberapa card terpisah", () => {
      const r1 = {
        id: 1,
        user: { name: "A" },
        created_at: "2026-08-20T09:00:00Z",
        status: "open",
        progress: 0,
        type: "task",
        priority: "low",
        subject: "S",
        assign_to_id: null,
        assign_to: null,
        start_date: null,
        due_date: null,
        content: null,
      };
      const r2 = { ...r1, id: 2, user: { name: "B" } };
      const ticket = baseTicket({ responses: [r2, r1] });
      renderShow({ ticket });

      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
    });
  });
});
