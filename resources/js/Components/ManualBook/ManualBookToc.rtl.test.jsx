import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key, fallback) => fallback ?? key }),
}));

import ManualBookToc from "./ManualBookToc";

describe("ManualBookToc", () => {
  it("mengembalikan null (tidak merender apa pun) saat headings kosong", () => {
    const { container } = render(<ManualBookToc headings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("h2 tanpa h3 di bawahnya dirender sebagai link biasa (tanpa dropdown trigger)", () => {
    render(
      <ManualBookToc
        headings={[{ id: "intro", text: "Pendahuluan", level: 2 }]}
      />,
    );
    const link = screen.getByText("Pendahuluan").closest("a");
    expect(link).toHaveAttribute("href", "#intro");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("h2 dengan h3 di bawahnya dikelompokkan jadi collapsible group", () => {
    render(
      <ManualBookToc
        headings={[
          { id: "sec-1", text: "Bagian 1", level: 2 },
          { id: "sec-1-a", text: "Sub A", level: 3 },
          { id: "sec-1-b", text: "Sub B", level: 3 },
          { id: "sec-2", text: "Bagian 2", level: 2 },
        ]}
      />,
    );
    // Bagian 1 punya trigger dropdown (collapsible), Bagian 2 tidak.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Bagian 1")).toBeInTheDocument();
    expect(screen.getByText("Bagian 2").closest("a")).toHaveAttribute(
      "href",
      "#sec-2",
    );
  });

  it("klik trigger group menampilkan sub-heading (h3) di dalamnya", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ManualBookToc
        headings={[
          { id: "sec-1", text: "Bagian 1", level: 2 },
          { id: "sec-1-a", text: "Sub A", level: 3 },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("Sub A")).toBeInTheDocument();
    expect(screen.getByText("Sub A").closest("a")).toHaveAttribute(
      "href",
      "#sec-1-a",
    );
  });

  it("heading level 3 di awal (sebelum h2 apa pun) diabaikan tanpa crash", () => {
    render(
      <ManualBookToc
        headings={[
          { id: "orphan", text: "Orphan H3", level: 3 },
          { id: "sec-1", text: "Bagian 1", level: 2 },
        ]}
      />,
    );
    expect(screen.queryByText("Orphan H3")).not.toBeInTheDocument();
    expect(screen.getByText("Bagian 1")).toBeInTheDocument();
  });
});
