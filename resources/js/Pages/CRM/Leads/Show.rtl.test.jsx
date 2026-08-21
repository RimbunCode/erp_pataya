import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Show.jsx (CRM/Leads) compose <FormPage><Form/></FormPage> dengan controls()
// render-prop. Logic UNIK yang jadi fokus:
// - controls: null kalau !lead (create mode)
// - isConverted (lead.status === "converted"): tampilkan link ke customer
//   hasil convert (route customers.show + convertTemplateLink(converted_customer))
// - belum converted: tombol "convert to customer" digate can("write") dari
//   usePermission(model) -- model diambil dari usePage().props.model
// - handleConvert: router.put ke route leads.convert dengan lead.id, TANPA
//   dialog konfirmasi (langsung fire)

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerPut = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { put: (...a) => routerPut(...a) },
  usePage: () => usePageMock(),
}));

const canMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: (model) => {
    canMock.model = model;
    return { can: (...a) => canMock(...a) };
  },
}));

vi.mock("@/lib/linkModelUtils", () => ({
  convertTemplateLink: (value) => `templateLink:${value?.name ?? ""}`,
}));

vi.mock("@/Components/Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate })}
      </div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls() : controls}
      </div>
      <div data-testid="form-page-children">{children}</div>
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Show from "./Show";

function renderShow(lead) {
  usePageMock.mockReturnValue({ props: { model: "App\\Models\\CRM\\Lead" } });
  return render(<Show lead={lead} />);
}

describe("Show (CRM/Leads)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMock.mockReturnValue(true);
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    renderShow({ id: 1, status: "open" });

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat lead tidak ada", () => {
    renderShow(null);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: true }),
    );
  });

  it("create mode (lead null): controls kosong", () => {
    renderShow(null);

    expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
  });

  describe("belum converted", () => {
    it("can('write') true: tombol convert_to_customer muncul", () => {
      canMock.mockReturnValue(true);
      renderShow({ id: 1, status: "open" });

      expect(
        screen.getByText("crm.lead.convert_to_customer"),
      ).toBeInTheDocument();
    });

    it("can('write') dipanggil dengan argumen 'write'", () => {
      renderShow({ id: 1, status: "open" });

      expect(canMock).toHaveBeenCalledWith("write");
    });

    it("usePermission dipanggil dengan model dari usePage().props.model", () => {
      renderShow({ id: 1, status: "open" });

      expect(canMock.model).toBe("App\\Models\\CRM\\Lead");
    });

    it("can('write') false: tombol convert_to_customer TIDAK muncul", () => {
      canMock.mockReturnValue(false);
      renderShow({ id: 1, status: "open" });

      expect(
        screen.queryByText("crm.lead.convert_to_customer"),
      ).not.toBeInTheDocument();
    });

    it("klik tombol convert memanggil router.put ke leads.convert dengan lead.id, tanpa dialog", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({ id: 42, status: "open" });

      await user.click(screen.getByText("crm.lead.convert_to_customer"));

      expect(routerPut).toHaveBeenCalledWith(`leads.convert/${JSON.stringify(42)}`);
    });
  });

  describe("sudah converted", () => {
    it("menampilkan label converted_to dan link ke customer hasil convert", () => {
      renderShow({
        id: 1,
        status: "converted",
        converted_customer_id: 9,
        converted_customer: { name: "PT Maju Jaya" },
      });

      expect(screen.getByText("crm.lead.converted_to")).toBeInTheDocument();
      expect(
        screen.getByText("templateLink:PT Maju Jaya"),
      ).toBeInTheDocument();
    });

    it("link customer mengarah ke route customers.show dengan converted_customer_id", () => {
      renderShow({
        id: 1,
        status: "converted",
        converted_customer_id: 9,
        converted_customer: { name: "PT Maju Jaya" },
      });

      expect(
        screen.getByText("templateLink:PT Maju Jaya").closest("a"),
      ).toHaveAttribute("href", `customers.show/${JSON.stringify(9)}`);
    });

    it("tombol convert_to_customer TIDAK muncul saat sudah converted (walau can write true)", () => {
      canMock.mockReturnValue(true);
      renderShow({
        id: 1,
        status: "converted",
        converted_customer_id: 9,
        converted_customer: { name: "PT Maju Jaya" },
      });

      expect(
        screen.queryByText("crm.lead.convert_to_customer"),
      ).not.toBeInTheDocument();
    });
  });
});
