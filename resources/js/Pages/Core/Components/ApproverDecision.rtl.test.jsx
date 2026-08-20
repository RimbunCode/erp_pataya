import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

window.route = (name, id) => (id ? `${name}/${id}` : name);

import ApproverDecision from "./ApproverDecision";

function makeApproval({ steps, current_sequence = 0 }) {
  return { steps, current_sequence };
}

describe("ApproverDecision", () => {
  beforeEach(() => {
    useFormReturn.data = {};
    useFormReturn.setData.mockReset();
    useFormReturn.post.mockReset();
    useFormReturn.reset.mockReset();
    useFormReturn.processing = false;
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
    usePageMock.mockReturnValue({ props: { auth: { user: { id: 1, id_roles: [] } } } });

    const { container } = render(
      <ApproverDecision name="logs" approval={approval} />,
    );
    expect(container).toBeEmptyDOMElement();
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
      screen.getByRole("button", { name: "TR:core.form.approvalDecision.trigger" }),
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
      screen.getByRole("button", { name: "TR:core.form.approvalDecision.trigger" }),
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

  it("klik cancel menutup dialog tanpa memanggil post", async () => {
    const user = userEvent.setup({ delay: null });
    const approval = makeApproval({
      steps: [{ id: 10, is_advanced: false, approver: { id: 1 } }],
    });

    render(<ApproverDecision name="logs" approval={approval} />);
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.approvalDecision.trigger" }),
    );
    await user.click(screen.getByRole("button", { name: "TR:core.form.cancel" }));

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
      screen.getByRole("button", { name: "TR:core.form.approvalDecision.trigger" }),
    );

    expect(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /TR:core.form.submit/ }),
    ).toBeDisabled();
  });
});
