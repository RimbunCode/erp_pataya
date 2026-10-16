import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Result from "./Result";

vi.mock("@inertiajs/react", () => ({
  Head: () => null,
  Link: ({ href, children }) => <a href={href}>{children}</a>,
}));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <main>{children}</main>,
}));

describe("batch PO result", () => {
  it("lists every saved draft with its own link", () => {
    render(
      <Result
        purchaseOrders={[
          {
            id: "po-1",
            code: "PO-001",
            supplier: "Supplier A",
            items_count: 2,
            url: "/purchaseOrders/po-1",
          },
          {
            id: "po-2",
            code: "PO-002",
            supplier: "Supplier B",
            items_count: 1,
            url: "/purchaseOrders/po-2",
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /PO-001/ })).toHaveAttribute(
      "href",
      "/purchaseOrders/po-1",
    );
    expect(screen.getByRole("link", { name: /PO-002/ })).toHaveAttribute(
      "href",
      "/purchaseOrders/po-2",
    );
    expect(screen.getByText("Supplier A")).toBeInTheDocument();
    expect(screen.getByText("purchase.purchaseOrder.from_requests.item_count: 2")).toBeInTheDocument();
    expect(screen.getByText("purchase.purchaseOrder.from_requests.item_count: 1")).toBeInTheDocument();
  });
});
