import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Kolom virtual `against_account_view` (GeneralLedger::$configColumns, Task 10.4):
// akun lawan sebagai tautan; bila `against_account_id` null (jurnal 3 baris atau
// lebih) tampil label "Beberapa akun" lewat `<when>` + `|trans`. Template ini
// disalin dari model dan dirender oleh SemanticTemplate asli.

const TEMPLATE =
  '<nav-link to="against_account">:against_account.account_name</nav-link><when field="multiple_accounts"><muted>:multiple_accounts|trans</muted></when>';

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: {} }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import SemanticTemplate from "@/Components/SemanticTemplate/SemanticTemplate";

const column = {
  name: "against_account_view",
  valueTrans: "finances.generalLedger.multiple_accounts_state",
};

const renderRow = (row) =>
  render(<SemanticTemplate template={TEMPLATE} row={row} column={column} />);

describe("GeneralLedger kolom against_account_view", () => {
  beforeEach(() => {
    window.route = (name, id) => `/${name}/${id}`;
  });

  it("baris dengan akun lawan: nama akun sebagai tautan, tanpa label beberapa akun", () => {
    renderRow({
      multiple_accounts: 0,
      against_account: {
        id: "a2",
        account_name: "Penjualan",
        route: "accounts",
        thisModel: "App\\Models\\Finances\\Account",
      },
    });

    expect(screen.getByText("Penjualan")).toBeInTheDocument();
    expect(
      screen.queryByText("TR:finances.generalLedger.multiple_accounts_state.1"),
    ).toBeNull();
  });

  it("against_account_id null: label Beberapa akun dari kunci terjemahan", () => {
    renderRow({ multiple_accounts: 1, against_account: null });

    expect(
      screen.getByText("TR:finances.generalLedger.multiple_accounts_state.1"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
