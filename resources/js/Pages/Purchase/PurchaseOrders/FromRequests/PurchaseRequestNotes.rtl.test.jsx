import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@inertiajs/react", () => ({
  Link: ({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import PurchaseRequestNotes from "./PurchaseRequestNotes";

window.route = (name, id) => `/${name}/${id}`;
const prefix = "purchase.purchaseOrder.from_requests.";

describe("PR notes", () => {
  it("collapses full notes, deduplicates PRs and links each source", async () => {
    const note = "Maintenance information\n" + "Long details ".repeat(100);
    const source = { id: "pr-1", code: "PR-001", external_note: note };
    render(<PurchaseRequestNotes sources={[source, source]} />);
    expect(
      screen.queryByText(/Maintenance information/),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: `${prefix}pr_notes` }),
    );
    expect(screen.getAllByRole("link", { name: "PR-001" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "PR-001" })).toHaveAttribute(
      "href",
      "/purchaseRequests.show/pr-1",
    );
    expect(screen.getByText(/Maintenance information/).textContent).toBe(note);
    await userEvent.click(
      screen.getByRole("button", { name: `${prefix}pr_notes` }),
    );
    expect(
      screen.queryByText(/Maintenance information/),
    ).not.toBeInTheDocument();
  });

  it("identifies an empty note without replacing another PR note", async () => {
    render(
      <PurchaseRequestNotes
        sources={[
          { id: 1, code: "PR-001", external_note: "  " },
          { id: 2, code: "PR-002", external_note: "Replace light" },
        ]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: `${prefix}pr_notes` }),
    );
    expect(screen.getByText(`${prefix}no_pr_note`)).toBeInTheDocument();
    expect(screen.getByText("Replace light")).toBeInTheDocument();
  });

  it("has a readable empty state when no PR remains", async () => {
    render(<PurchaseRequestNotes sources={[]} />);
    await userEvent.click(
      screen.getByRole("button", { name: `${prefix}pr_notes` }),
    );
    expect(screen.getByText(`${prefix}no_pr_sources`)).toBeInTheDocument();
  });
});
