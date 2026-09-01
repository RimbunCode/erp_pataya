import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

window.route = (name, id) => `${name}/${id}`;

import UserInfo from "./UserInfo";

const baseUser = {
  id: 1,
  name: "Budi Santoso",
  username: "budi",
  email: "budi@example.com",
  picture: null,
};

describe("UserInfo", () => {
  it("menampilkan alias 2 huruf pertama dari nama depan+belakang", () => {
    usePageMock.mockReturnValue({ props: { auth: { user: baseUser } } });
    render(<UserInfo />);
    expect(screen.getByText("BS")).toBeInTheDocument();
  });

  it("alias untuk nama satu kata hanya 1 huruf", () => {
    usePageMock.mockReturnValue({
      props: { auth: { user: { ...baseUser, name: "Budi" } } },
    });
    render(<UserInfo />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("klik trigger membuka dropdown berisi nama, username, email", async () => {
    const user = userEvent.setup({ delay: null });
    usePageMock.mockReturnValue({ props: { auth: { user: baseUser } } });
    render(<UserInfo />);

    await user.click(screen.getByText("BS"));

    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("budi")).toBeInTheDocument();
    expect(screen.getByText("budi@example.com")).toBeInTheDocument();
  });

  it("menampilkan link Manage Account dan Log out (Link as='button', bukan <a>)", async () => {
    const user = userEvent.setup({ delay: null });
    usePageMock.mockReturnValue({ props: { auth: { user: baseUser } } });
    render(<UserInfo />);

    await user.click(screen.getByText("BS"));

    // UserInfo.jsx eksplisit set as="button" pada kedua Link ini, sehingga
    // Link (lihat resources/js/Components/Link.jsx) merender <button> tanpa
    // atribut href -- bukan <a>. route() dipanggil untuk resolve URL saja.
    expect(
      screen.getByText("Manage Account").closest("button"),
    ).toBeInTheDocument();
    expect(screen.getByText("Log out").closest("button")).toBeInTheDocument();
  });
});
