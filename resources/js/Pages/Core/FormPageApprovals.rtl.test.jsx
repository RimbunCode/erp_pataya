import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tabs } from "@/Components/ui/tabs";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

import { Approvals } from "./FormPage";

const child = (id, name, status) => ({
  id,
  approver_type: "user",
  approver: { name, templateLink: ":name" },
  status,
  acted_by: null,
  acted_at: null,
});

function renderApprovals(approvals) {
  return render(
    <Tabs value="approvals">
      <Approvals approvals={approvals} />
    </Tabs>,
  );
}

describe("Approvals tab - step multi-approver", () => {
  it("menampilkan approver anak sejak step masih pending", () => {
    renderApprovals([
      {
        id: "s1",
        status: "pending",
        is_advanced: true,
        approvers: [
          child("c1", "Alice", "pending"),
          child("c2", "Bob", "pending"),
        ],
      },
    ]);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("step biasa yang pending tidak punya detail yang bisa dibuka", async () => {
    renderApprovals([
      {
        id: "s1",
        status: "pending",
        is_advanced: false,
        approver_type: "user",
        approver: { name: "Carol", templateLink: ":name" },
        approvers: [],
      },
    ]);

    expect(screen.getByText("Carol")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Carol"));
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});
