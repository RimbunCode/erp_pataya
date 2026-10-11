import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const usePageMock = vi.fn();
const useFormReturn = {
  data: {},
  setData: vi.fn(),
  post: vi.fn(),
  reset: vi.fn(),
  processing: false,
};
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  useForm: () => useFormReturn,
}));

// Select (Popover/Command berbasis Radix) punya test sendiri -- stub di sini
// agar test ApproverDecision fokus ke logic dialog: visibility berdasar
// approver, dan submit form. Pola sama seperti FilterTable2.rtl.test.jsx
// men-stub FilterBuilderBody.
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      data-testid="stub-select"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="" />
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ),
}));

const toastMock = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/lib/gooeyToast", () => ({ gooeyToast: toastMock }));

window.route = (name, id) => (id ? `${name}/${id}` : name);

import ApproverDecision from "./ApproverDecision";

function makeApproval({ steps, current_sequence = 0, status = "pending" }) {
  return {
    status,
    current_sequence,
    steps: steps.map((step) => ({ status: "pending", ...step })),
  };
}

describe("ApproverDecision", () => {
  beforeEach(() => {
    useFormReturn.data = {};
    useFormReturn.setData.mockReset();
    useFormReturn.post.mockReset();
    useFormReturn.reset.mockReset();
    useFormReturn.processing = false;
    toastMock.warning.mockClear();
    usePageMock.mockReturnValue({ props: { auth: { user: { id: 1 } } } });
  });

  it("tidak merender apa pun bila tidak ada currentStep (approval null)", () => {
    const { container } = render(
      <ApproverDecision name="logs" approval={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("tidak merender apa pun bila user bukan approver (simple, bukan id/role cocok)", () => {
    const approval = makeApproval({
      steps: [
        {
          id: 10,
          is_advanced: false,
          approver: { id: 999 },
        },
      ],
    });
    usePageMock.mockReturnValue({
      props: { auth: { user: { id: 1, id_roles: [] } } },
    });

    const { container } = render(
      <ApproverDecision name="logs" approval={approval} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("tidak merender tombol setelah approval selesai walau user cocok dengan step lama yang di-skip (auto-approve penuh, current_sequence tetap 0)", () => {
    const approval = makeApproval({
      status: "approved",
      current_sequence: 0,
      steps: [
        { id: 1, status: "skipped", is_advanced: false, approver: { id: 42 } },
        { id: 2, status: "approved", is_advanced: false, approver: { id: 1 } },
      ],
    });
    usePageMock.mockReturnValue({
      props: { auth: { user: { id: 1, id_roles: [42] } } },
    });

    const { container } = render(
      <ApproverDecision name="logs" approval={approval} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("tidak merender tombol bila instance sudah rejected", () => {
    const approval = makeApproval({
      status: "rejected",
      steps: [
        { id: 1, status: "rejected", is_advanced: false, approver: { id: 1 } },
      ],
    });

    const { container } = render(
      <ApproverDecision name="logs" approval={approval} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("tidak merender tombol bila tak ada step pending meski instance masih pending", () => {
    const approval = makeApproval({
      steps: [
        { id: 1, status: "approved", is_advanced: false, approver: { id: 1 } },
        { id: 2, status: "waiting", is_advanced: false, approver: { id: 1 } },
      ],
    });

    const { container } = render(
      <ApproverDecision name="logs" approval={approval} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("menilai step pending sebenarnya, bukan steps[current_sequence] yang sudah diputuskan", async () => {
    const user = userEvent.setup({ delay: null });
    const approval = makeApproval({
      current_sequence: 0,
      steps: [
        { id: 10, status: "approved", is_advanced: false, approver: { id: 1 } },
        { id: 20, status: "pending", is_advanced: false, approver: { id: 1 } },
      ],
    });

    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.submit" }),
    );

    expect(useFormReturn.post).toHaveBeenCalledWith(
      "approvalInstances.decision/20",
      expect.anything(),
    );
  });

  it("merender tombol trigger bila user cocok sebagai approver simple (by id)", () => {
    const approval = makeApproval({
      steps: [{ id: 10, is_advanced: false, approver: { id: 1 } }],
    });

    render(<ApproverDecision name="logs" approval={approval} />);

    expect(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    ).toBeInTheDocument();
  });

  it("merender tombol trigger bila user cocok lewat id_roles (approver simple by role)", () => {
    const approval = makeApproval({
      steps: [{ id: 10, is_advanced: false, approver: { id: 42 } }],
    });
    usePageMock.mockReturnValue({
      props: { auth: { user: { id: 1, id_roles: [42] } } },
    });

    render(<ApproverDecision name="logs" approval={approval} />);

    expect(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    ).toBeInTheDocument();
  });

  it("advanced step: user cocok lewat approvers[].approver_type user", () => {
    const approval = makeApproval({
      steps: [
        {
          id: 10,
          is_advanced: true,
          approvers: [
            { approver_type: "user", approver: { id: 1 } },
            { approver_type: "user", approver: { id: 2 } },
          ],
        },
      ],
    });

    render(<ApproverDecision name="logs" approval={approval} />);

    expect(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    ).toBeInTheDocument();
  });

  it("advanced step: user tidak cocok di approvers manapun tidak merender apa pun", () => {
    const approval = makeApproval({
      steps: [
        {
          id: 10,
          is_advanced: true,
          approvers: [{ approver_type: "user", approver: { id: 999 } }],
        },
      ],
    });

    const { container } = render(
      <ApproverDecision name="logs" approval={approval} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("klik trigger membuka dialog dengan field decision dan notes", async () => {
    const user = userEvent.setup({ delay: null });
    const approval = makeApproval({
      steps: [{ id: 10, is_advanced: false, approver: { id: 1 } }],
    });

    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    );

    expect(
      screen.getByText("TR:core.form.approvalDecision.title"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("stub-select")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:core.form.submit" }),
    ).toBeInTheDocument();
  });

  it("submit form memanggil post ke route approvalInstances.decision dengan currentStep.id", async () => {
    const user = userEvent.setup({ delay: null });
    const approval = makeApproval({
      steps: [{ id: 77, is_advanced: false, approver: { id: 1 } }],
    });

    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.submit" }),
    );

    expect(useFormReturn.post).toHaveBeenCalledWith(
      "approvalInstances.decision/77",
      expect.objectContaining({
        reset: ["logs", "logs", "flash"],
        preserveState: true,
        replace: true,
      }),
    );
  });

  async function submitAndGetOptions() {
    const user = userEvent.setup({ delay: null });
    const approval = makeApproval({
      steps: [{ id: 77, is_advanced: false, approver: { id: 1 } }],
    });
    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.submit" }),
    );
    return useFormReturn.post.mock.calls[0][1];
  }

  it("menampilkan toast peringatan saat respons membawa flash.alert (klik ulang/halaman basi)", async () => {
    const options = await submitAndGetOptions();

    act(() => {
      options.onSuccess({
        props: { flash: { alert: { message: "Langkah sudah diputuskan" } } },
      });
    });

    expect(toastMock.warning).toHaveBeenCalledWith("Langkah sudah diputuskan");
    expect(useFormReturn.reset).toHaveBeenCalled();
  });

  it("tidak menampilkan toast bila respons tanpa flash.alert", async () => {
    const options = await submitAndGetOptions();

    act(() => {
      options.onSuccess({ props: { flash: {} } });
    });

    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(useFormReturn.reset).toHaveBeenCalled();
  });

  it("klik cancel menutup dialog tanpa memanggil post", async () => {
    const user = userEvent.setup({ delay: null });
    const approval = makeApproval({
      steps: [{ id: 10, is_advanced: false, approver: { id: 1 } }],
    });

    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    );

    expect(useFormReturn.post).not.toHaveBeenCalled();
    expect(
      screen.queryByText("TR:core.form.approvalDecision.title"),
    ).not.toBeInTheDocument();
  });

  it("saat processing=true, tombol submit/cancel disabled", async () => {
    const user = userEvent.setup({ delay: null });
    useFormReturn.processing = true;
    const approval = makeApproval({
      steps: [{ id: 10, is_advanced: false, approver: { id: 1 } }],
    });

    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.form.approvalDecision.trigger",
      }),
    );

    expect(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /TR:core.form.submit/ }),
    ).toBeDisabled();
  });
});
