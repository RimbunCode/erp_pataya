import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key, params) =>
  params ? `${key}|${JSON.stringify(params)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
const routerMock = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: routerMock,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

import RuleVersionsTab, { initialVersionValues } from "./RuleVersionsTab";

const DEFAULTS = {
  dpp_numerator: 11,
  dpp_denominator: 12,
  rounding_mode: "per_line",
  output_role: "tax_output",
  input_role: "tax_input",
};

const version = (overrides) => ({
  id: "v1",
  version: 1,
  status: "active",
  effective_from: "2026-01-01",
  effective_to: null,
  rate: "12.0000",
  dpp_numerator: 11,
  dpp_denominator: 12,
  rounding_mode: "per_line",
  output_role: "tax_output",
  input_role: "tax_input",
  notes: null,
  created_by: "Admin",
  ...overrides,
});

const setProps = (props) =>
  usePageMock.mockReturnValue({
    props: {
      canViewRuleVersions: true,
      canManageRuleVersions: true,
      ruleVersionDefaults: DEFAULTS,
      ruleVersions: [],
      ...props,
    },
  });

const renderTab = () => render(<RuleVersionsTab taxId="tax-1" taxRate={12} />);

describe("Finances Taxes RuleVersionsTab", () => {
  beforeEach(() => {
    Object.values(routerMock).forEach((fn) => fn.mockReset());
    window.route = (name, params) => `/${name}/${[params].flat().join("/")}`;
  });

  it("tidak dirender tanpa izin membaca versi aturan", () => {
    setProps({ canViewRuleVersions: false, ruleVersions: [version()] });
    const { container } = renderTab();

    expect(container).toBeEmptyDOMElement();
  });

  it("memperingatkan bila pajak belum punya versi aktif", () => {
    setProps({ ruleVersions: [version({ status: "draft" })] });
    renderTab();

    expect(
      screen.getByText("finances.taxRuleVersion.tab.no_active"),
    ).toBeInTheDocument();
  });

  it("menampilkan pesan kosong dan tidak memperingatkan bila ada versi aktif", () => {
    setProps({ ruleVersions: [] });
    const { unmount } = renderTab();
    expect(
      screen.getByText("finances.taxRuleVersion.tab.empty"),
    ).toBeInTheDocument();
    unmount();

    setProps({ ruleVersions: [version()] });
    renderTab();
    expect(
      screen.queryByText("finances.taxRuleVersion.tab.no_active"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("rule-version-row")).toHaveLength(1);
    expect(screen.getByText("11/12")).toBeInTheDocument();
  });

  it("menyembunyikan semua aksi tulis tanpa izin kelola", () => {
    setProps({
      canManageRuleVersions: false,
      ruleVersions: [
        version(),
        version({ id: "v2", version: 2, status: "draft" }),
      ],
    });
    renderTab();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("menampilkan aksi sesuai status versi", () => {
    setProps({
      ruleVersions: [
        version({ id: "v3", version: 3, status: "retired" }),
        version({ id: "v2", version: 2, status: "draft" }),
        version(),
      ],
    });
    renderTab();

    const [retired, draft, active] = screen.getAllByTestId("rule-version-row");
    expect(within(retired).queryByRole("button")).not.toBeInTheDocument();
    expect(
      within(draft).getByText("finances.taxRuleVersion.tab.actions.activate"),
    ).toBeInTheDocument();
    expect(
      within(draft).getByText("finances.taxRuleVersion.tab.actions.edit"),
    ).toBeInTheDocument();
    expect(
      within(draft).getByText("finances.taxRuleVersion.tab.actions.discard"),
    ).toBeInTheDocument();
    expect(
      within(active).getByText("finances.taxRuleVersion.tab.actions.retire"),
    ).toBeInTheDocument();
    expect(
      within(active).queryByText(
        "finances.taxRuleVersion.tab.actions.activate",
      ),
    ).not.toBeInTheDocument();
  });

  it("versi baru memakai nilai versi terbaru dan faktor DPP dari server, lalu dikirim sebagai draft", async () => {
    const user = userEvent.setup({ delay: null });
    setProps({ ruleVersions: [version({ rate: "11.0000" })] });
    renderTab();

    await user.click(screen.getByText("finances.taxRuleVersion.tab.add"));
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByLabelText("finances.taxRuleVersion.columns.rate"),
    ).toHaveValue(11);
    expect(
      within(dialog).getByLabelText(
        "finances.taxRuleVersion.columns.dpp_numerator",
      ),
    ).toHaveValue(11);
    expect(
      within(dialog).getByLabelText(
        "finances.taxRuleVersion.columns.dpp_denominator",
      ),
    ).toHaveValue(12);
    expect(
      within(dialog).getByLabelText(
        "finances.taxRuleVersion.columns.effective_from",
      ),
    ).toHaveValue("");

    await user.type(
      within(dialog).getByLabelText(
        "finances.taxRuleVersion.columns.effective_from",
      ),
      "2026-07-01",
    );
    await user.click(
      within(dialog).getByText("finances.taxRuleVersion.tab.form.save"),
    );

    expect(routerMock.post).toHaveBeenCalledTimes(1);
    const [url, payload] = routerMock.post.mock.calls[0];
    expect(url).toBe("/taxRuleVersions.save/tax-1");
    expect(payload).toMatchObject({
      effective_from: "2026-07-01",
      rate: "11.0000",
      dpp_numerator: "11",
      dpp_denominator: "12",
      rounding_mode: "per_line",
      output_role: "tax_output",
      input_role: "tax_input",
    });
  });

  it("menampilkan galat validasi server pada dialog", async () => {
    const user = userEvent.setup({ delay: null });
    setProps({ ruleVersions: [] });
    routerMock.post.mockImplementation((_url, _payload, options) => {
      options.onError({ rate: "Tarif tidak valid", version: "Tumpang-tindih" });
    });
    renderTab();

    await user.click(screen.getByText("finances.taxRuleVersion.tab.add"));
    await user.click(
      within(screen.getByRole("dialog")).getByText(
        "finances.taxRuleVersion.tab.form.save",
      ),
    );

    expect(screen.getByText("Tarif tidak valid")).toBeInTheDocument();
    expect(screen.getByText("Tumpang-tindih")).toBeInTheDocument();
  });

  it("mengubah draft mengirim PUT ke route draft dengan nilai tersimpan", async () => {
    const user = userEvent.setup({ delay: null });
    setProps({
      ruleVersions: [
        version({
          id: "v2",
          version: 2,
          status: "draft",
          effective_from: "2026-07-01",
          notes: "catatan",
        }),
      ],
    });
    renderTab();

    await user.click(
      screen.getByText("finances.taxRuleVersion.tab.actions.edit"),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByLabelText(
        "finances.taxRuleVersion.columns.effective_from",
      ),
    ).toHaveValue("2026-07-01");
    await user.click(
      within(dialog).getByText("finances.taxRuleVersion.tab.form.save"),
    );

    const [url, payload] = routerMock.put.mock.calls[0];
    expect(url).toBe("/taxRuleVersions.updateDraft/tax-1/v2");
    expect(payload.notes).toBe("catatan");
  });

  it("aktivasi meminta konfirmasi lalu memanggil route activate dan menampilkan galat domain", async () => {
    const user = userEvent.setup({ delay: null });
    setProps({
      ruleVersions: [version({ id: "v2", version: 2, status: "draft" })],
    });
    routerMock.put.mockImplementation((_url, _payload, options) => {
      options.onError({ version: "Faktor DPP belum dapat diaktifkan" });
    });
    renderTab();

    await user.click(
      screen.getByText("finances.taxRuleVersion.tab.actions.activate"),
    );
    expect(routerMock.put).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByText(
        "finances.taxRuleVersion.tab.confirm.activate.confirm",
      ),
    );

    expect(routerMock.put.mock.calls[0][0]).toBe(
      "/taxRuleVersions.activate/tax-1/v2",
    );
    expect(
      screen.getByText("Faktor DPP belum dapat diaktifkan"),
    ).toBeInTheDocument();
  });

  it("pensiun memakai PUT retire dan hapus draft memakai DELETE", async () => {
    const user = userEvent.setup({ delay: null });
    setProps({
      ruleVersions: [
        version({ id: "v2", version: 2, status: "draft" }),
        version(),
      ],
    });
    renderTab();

    await user.click(
      screen.getByText("finances.taxRuleVersion.tab.actions.retire"),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText(
        "finances.taxRuleVersion.tab.confirm.retire.confirm",
      ),
    );
    expect(routerMock.put.mock.calls[0][0]).toBe(
      "/taxRuleVersions.retire/tax-1/v1",
    );

    await user.keyboard("{Escape}");
    await user.click(
      screen.getByText("finances.taxRuleVersion.tab.actions.discard"),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText(
        "finances.taxRuleVersion.tab.confirm.discard.confirm",
      ),
    );
    expect(routerMock.delete.mock.calls[0][0]).toBe(
      "/taxRuleVersions.discard/tax-1/v2",
    );
  });

  it("aksi di dialog tidak men-submit form induk (halaman Pajak berada di dalam <form>)", async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn((event) => event.preventDefault());
    setProps({ ruleVersions: [] });
    render(
      <form onSubmit={onSubmit}>
        <RuleVersionsTab taxId="tax-1" taxRate={12} />
      </form>,
    );

    await user.click(screen.getByText("finances.taxRuleVersion.tab.add"));
    await user.click(
      within(screen.getByRole("dialog")).getByText(
        "finances.taxRuleVersion.tab.form.save",
      ),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(routerMock.post).toHaveBeenCalledTimes(1);
  });

  describe("initialVersionValues", () => {
    it("versi baru mengosongkan tanggal dan catatan, mengambil tarif master bila belum ada versi", () => {
      expect(initialVersionValues(null, DEFAULTS, false, 12)).toEqual({
        effective_from: "",
        effective_to: "",
        rate: "12",
        dpp_numerator: "11",
        dpp_denominator: "12",
        rounding_mode: "per_line",
        output_role: "tax_output",
        input_role: "tax_input",
        notes: "",
      });
    });
  });
});
