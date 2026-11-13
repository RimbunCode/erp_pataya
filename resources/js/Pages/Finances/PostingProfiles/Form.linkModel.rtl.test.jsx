import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// AccountLinkModel dan LinkModel NYATA (hanya fetch, izin, dan dialog form akun yang dipalsukan): membuktikan nilai
// akun dari props controller (termasuk `thisModel`) tampil sebagai label dan tidak dibuang validasi LinkModel.

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
  FormPageContent: () => null,
  useFormPage: () => ({ data: {}, setData: () => {} }),
}));
vi.mock("@/Pages/Finances/Accounts/Form", () => ({ default: () => null }));
vi.mock("axios", () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { data: [], total: 0 } }),
  },
}));

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  routerPut: vi.fn(),
}));

vi.mock("@inertiajs/react", async () => {
  const React = await import("react");

  return {
    Head: () => null,
    router: { put: mocks.routerPut, delete: vi.fn() },
    usePage: () => ({ props: {} }),
    useForm: (initial) => {
      const [data, setDataState] = React.useState(initial);

      return {
        data,
        setData: (key, value) =>
          setDataState((current) =>
            typeof key === "string"
              ? { ...current, [key]: value }
              : { ...current, ...key },
          ),
        post: (url) => mocks.post(url, data),
        put: (url) => mocks.put(url, data),
        errors: {},
        processing: false,
      };
    },
  };
});
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Form from "./Form";
import { TooltipProvider } from "@/Components/ui/tooltip";

const ACCOUNT_MODEL = ["App", "Models", "Finances", "Account"].join(
  String.fromCharCode(92),
);

// Persis bentuk objek akun dari PostingProfileController::profilePayload().
const account = (id, number, name) => ({
  id,
  account_number: number,
  account_name: name,
  is_group: false,
  is_disabled: false,
  thisModel: ACCOUNT_MODEL,
  templateLink: ":account_number - :account_name",
  route: "accounts",
  keyModel: "id",
});

const roles = [
  {
    value: "receivable",
    label: "Piutang",
    line_sensitive: false,
    master: false,
  },
  {
    value: "revenue",
    label: "Pendapatan",
    line_sensitive: true,
    master: false,
  },
];

const profile = (status = "draft") => ({
  id: "p1",
  name: "Profil",
  status,
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  notes: null,
  previous_profile_id: null,
  accounts: { receivable: account("a-ar", "1231", "Piutang Dagang") },
  rules: [],
});

const render = async (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let result;
  await act(async () => {
    result = rtlRender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  });

  return result;
};

const props = {
  roles,
  canWrite: true,
  canActivate: true,
  defaultFrom: "2026-07-01",
};

describe("PostingProfiles Form dengan LinkModel nyata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menampilkan label akun tersimpan dan Simpan tanpa perubahan mengirim pemetaan yang sama", async () => {
    const user = userEvent.setup();
    await render(<Form {...props} profile={profile()} />);

    expect(
      screen.getByDisplayValue("1231 - Piutang Dagang"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "finances.postingProfile.form.save" }),
    );

    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][1].accounts).toEqual({ receivable: "a-ar" });
  });

  it("menghapus akun lewat tombol X LinkModel (aksi sah) mengosongkan pemetaan peran itu saat disimpan", async () => {
    const user = userEvent.setup();
    const { container } = await render(<Form {...props} profile={profile()} />);

    const row = container.querySelector('[data-role="receivable"]');
    const clear = row.querySelector("svg.lucide-x").closest("button");
    await user.click(clear);
    await user.click(
      screen.getByRole("button", { name: "finances.postingProfile.form.save" }),
    );

    expect(mocks.put.mock.calls[0][1].accounts.receivable).toBeNull();
  });

  it("nilai tanpa thisModel (data tidak dikenali LinkModel) tidak menghapus pemetaan saat disimpan", async () => {
    const user = userEvent.setup();
    const broken = profile();
    delete broken.accounts.receivable.thisModel;
    await render(<Form {...props} profile={broken} />);

    await user.click(
      screen.getByRole("button", { name: "finances.postingProfile.form.save" }),
    );

    expect(mocks.put.mock.calls[0][1].accounts).toEqual({ receivable: "a-ar" });
  });

  it("berganti status (aktivasi) me-remount tampilan dari data segar", async () => {
    const { rerender } = await render(
      <Form {...props} profile={profile("draft")} />,
    );
    expect(
      screen.getByDisplayValue("1231 - Piutang Dagang"),
    ).toBeInTheDocument();

    const active = profile("active");
    active.accounts = { receivable: account("a-ar", "1231", "Piutang Dagang") };
    await act(async () => {
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider delayDuration={0}>
            <Form {...props} profile={active} />
          </TooltipProvider>
        </QueryClientProvider>,
      );
    });

    expect(screen.getByTestId("read-only-note")).toBeInTheDocument();
    expect(screen.getByText("1231 - Piutang Dagang")).toBeInTheDocument();
    // hanya peran pendapatan yang memang belum dipetakan
    expect(
      screen.getAllByText("finances.postingProfile.form.unmapped_cell"),
    ).toHaveLength(1);
  });
});
