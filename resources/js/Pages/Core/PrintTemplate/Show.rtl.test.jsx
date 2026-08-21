import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Show.jsx (Core/PrintTemplate) compose <FormPage><Form/></FormPage> dengan
// controls() render-prop. Logic UNIK:
// - ignoreDraft = usePage().props.loadFrom
// - controls SELALU return tombol "Buka Editor" -> route printTemplates.editor
//   dengan printTemplate.id (LIHAT BUG di bawah)

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
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
  FormPage: ({ isCreate, ignoreDraft, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, ignoreDraft: !!ignoreDraft })}
      </div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls() : controls}
      </div>
      {children}
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Show from "./Show";

function renderShow(printTemplate, loadFrom) {
  usePageMock.mockReturnValue({ props: { loadFrom } });
  return render(<Show printTemplate={printTemplate} />);
}

describe("Show (Core/PrintTemplate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    renderShow({ id: 1 });

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate mengikuti !printTemplate", () => {
    renderShow({ id: 1 });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":false',
    );
  });

  it("ignoreDraft diteruskan dari usePage().props.loadFrom", () => {
    renderShow({ id: 1 }, { id: 5 });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"ignoreDraft":true',
    );
  });

  it("printTemplate ada: tombol open_editor muncul dengan href route printTemplates.editor + id", async () => {
    renderShow({ id: 42 });

    const link = screen.getByText("core.printTemplate.open_editor").closest(
      "a",
    );
    expect(link).toHaveAttribute(
      "href",
      `printTemplates.editor/${JSON.stringify(42)}`,
    );
  });

  // BUG PRODUKSI (belum diperbaiki, sudah dilaporkan terpisah -- task_d798bdbd):
  // controls() TIDAK gate `printTemplate` truthy dan akses `printTemplate.id`
  // TANPA optional chaining. PrintTemplateController@create me-render Show
  // TANPA prop printTemplate (undefined di halaman "buat print template
  // baru"), sehingga controls() throw TypeError saat render pertama. Test
  // ini mendokumentasikan crash tsb secara eksplisit -- JANGAN dihapus,
  // ganti jadi assert sukses begitu bug diperbaiki (gate `printTemplate &&`
  // di awal controls, atau minimal `printTemplate?.id`).
  it("BUG: printTemplate undefined (create mode) crash saat render karena controls() akses printTemplate.id tanpa optional chaining", () => {
    expect(() => renderShow(undefined)).toThrow(
      "Cannot read properties of undefined (reading 'id')",
    );
  });
});
