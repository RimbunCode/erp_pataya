import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Head di-mock jadi elemen yang expose title-nya lewat data-testid, supaya
// bisa diassert tanpa bergantung pada efek document.title asli Inertia.
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <div data-testid="head-title">{title}</div>,
}));

// AppLayout membungkus Navbar/Sidebar penuh (di luar scope test halaman
// Error) -- stub jadi passthrough yang meneruskan className & children apa
// adanya, supaya bisa diverifikasi kapan Error.jsx membungkus contentnya
// dengan AppLayout (useAppLayout=true) dan kapan tidak (default false).
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, className }) => (
    <div data-testid="stub-app-layout" className={className}>
      {children}
    </div>
  ),
}));

import Error from "./Error";

describe("Error - status dikenal", () => {
  it.each([
    [403, "403: Forbidden", "You are not allowed to access this page."],
    [
      404,
      "404: Page Not Found",
      "The page you are looking for could not be found.",
    ],
    [500, "500: Server Error", "Something went wrong on our side."],
    [
      503,
      "503: Service Unavailable",
      "The service is temporarily unavailable.",
    ],
  ])(
    "status %i menampilkan title dan description yang sesuai",
    (status, title, description) => {
      render(<Error status={status} />);

      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
      expect(screen.getByTestId("head-title")).toHaveTextContent(title);
    },
  );
});

describe("Error - status tidak dikenal", () => {
  it("fallback ke halaman 500 saat status bukan salah satu dari 403/404/500/503", () => {
    render(<Error status={418} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "500: Server Error" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong on our side."),
    ).toBeInTheDocument();
  });

  it("fallback ke halaman 500 saat status undefined", () => {
    render(<Error status={undefined} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "500: Server Error" }),
    ).toBeInTheDocument();
  });
});

describe("Error - useAppLayout", () => {
  it("default (useAppLayout tidak diberikan) TIDAK membungkus konten dengan AppLayout", () => {
    render(<Error status={404} />);

    expect(screen.queryByTestId("stub-app-layout")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("useAppLayout=false TIDAK membungkus konten dengan AppLayout", () => {
    render(<Error status={404} useAppLayout={false} />);

    expect(screen.queryByTestId("stub-app-layout")).not.toBeInTheDocument();
  });

  it("useAppLayout=true membungkus konten dengan AppLayout dan meneruskan className='justify-center'", () => {
    render(<Error status={404} useAppLayout />);

    const layout = screen.getByTestId("stub-app-layout");
    expect(layout).toBeInTheDocument();
    expect(layout).toHaveClass("justify-center");
    // Konten (heading) tetap dirender sebagai children AppLayout.
    expect(
      screen.getByRole("heading", { level: 1, name: "404: Page Not Found" }),
    ).toBeInTheDocument();
  });
});
