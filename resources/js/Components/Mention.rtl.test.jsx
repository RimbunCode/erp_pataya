import { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Mention as RealMention,
  MentionsInput as RealMentionsInput,
} from "react-mentions";

import { Mention, MentionsInput } from "./Mention";

// Mention.jsx TIDAK punya logic sendiri -- murni re-export Mention/MentionsInput
// dari react-mentions + side-effect import CSS (css/mention.css). Tidak ada
// forwardRef, className merge, atau prop custom untuk diuji secara terisolasi,
// jadi strategi test-nya adalah RTL render: pastikan re-export benar-benar
// components asli react-mentions (bukan salinan/wrapper), lalu uji integrasi
// Mention+MentionsInput yang sungguh di-render bersama sesuai pola pemakaian
// nyata di codebase (lihat resources/js/Pages/Core/EmailTemplate/Form.jsx,
// resources/js/Pages/Inventory/Items/Form.jsx,
// resources/js/Pages/Settings/FormatingSeries/Show.jsx,
// resources/js/Pages/Core/Components/EmailSendDialog.jsx).

const SUGGESTIONS = [
  { id: "1", display: "Alpha" },
  { id: "2", display: "Beta" },
];

// MentionsInput adalah class component (defaultProps class-nya tetap berlaku
// normal di React 19), tapi belum ada indikasi efek async murni di sini --
// tetap ikuti pola wajib project (bungkus render() itu sendiri dengan
// act(async () => {})) supaya konsisten & aman terhadap microtask apapun.
const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(ui);
  });
  return result;
};

function Basic({
  singleLine = false,
  disabled = false,
  placeholder = "Ketik @ untuk mention",
  onChangeSpy,
  data = SUGGESTIONS,
  displayTransform,
  ...rest
}) {
  const [value, setValue] = useState("");
  return (
    <MentionsInput
      singleLine={singleLine}
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(e, newValue, plainTextValue, mentions) => {
        setValue(newValue);
        onChangeSpy?.(e, newValue, plainTextValue, mentions);
      }}
      {...rest}
    >
      <Mention
        trigger="@"
        data={data}
        markup="@[__display__](__id__)"
        displayTransform={displayTransform}
      />
    </MentionsInput>
  );
}

describe("Mention (re-export dari react-mentions)", () => {
  it("mengekspor Mention dan MentionsInput yang identik dengan react-mentions asli (bukan salinan/wrapper)", () => {
    expect(Mention).toBe(RealMention);
    expect(MentionsInput).toBe(RealMentionsInput);
  });

  it("keduanya adalah komponen React yang valid (function component atau wrapper React seperti forwardRef/styled)", () => {
    // Mention: function component polos -- typeof "function".
    expect(typeof Mention).toBe("function");
    // MentionsInput: class component dibungkus HOC "styled" dari react-mentions
    // (lihat node_modules/react-mentions -- `styled$3(MentionsInput)`), hasilnya
    // objek React (forwardRef-like, typeof "object") -- bukan lagi function biasa.
    expect(["function", "object"]).toContain(typeof MentionsInput);
    expect(MentionsInput).toBeTruthy();
  });
});

describe("MentionsInput + Mention -- render dasar tanpa crash", () => {
  it("default (multi-line) render sebagai <textarea> dengan placeholder yang diteruskan", async () => {
    await render(<Basic />);
    const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("singleLine render sebagai <input>, bukan <textarea>", async () => {
    await render(<Basic singleLine placeholder="Subjek email" />);
    const input = screen.getByPlaceholderText("Subjek email");
    expect(input.tagName).toBe("INPUT");
  });

  it("prop arbitrer (autoComplete, data-testid) diteruskan ke elemen input/textarea asli", async () => {
    await render(<Basic data-testid="mentions-field" />);
    const textarea = screen.getByTestId("mentions-field");
    expect(textarea).toHaveAttribute("autoComplete", "off");
  });

  it("prop disabled pada MentionsInput diteruskan ke elemen underlying", async () => {
    await render(<Basic singleLine disabled placeholder="Nonaktif" />);
    const input = screen.getByPlaceholderText("Nonaktif");
    expect(input).toBeDisabled();
  });
});

describe("MentionsInput + Mention -- behavior interaktif utama", () => {
  it("mengetik teks biasa (tanpa trigger) memicu onChange dengan value & plainTextValue sesuai, tanpa membuka daftar saran", async () => {
    let lastPlainText = null;
    await render(
      <Basic
        onChangeSpy={(_e, _value, plainTextValue) => {
          lastPlainText = plainTextValue;
        }}
      />,
    );
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");

    await act(async () => {
      await user.type(textarea, "halo dunia");
    });

    expect(textarea).toHaveValue("halo dunia");
    expect(lastPlainText).toBe("halo dunia");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("mengetik karakter trigger '@' membuka daftar saran sesuai data (array statis)", async () => {
    await render(<Basic />);
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");

    await act(async () => {
      await user.type(textarea, "@Al");
    });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Beta" }),
    ).not.toBeInTheDocument();
  });

  it("data sebagai fungsi async (query, callback) juga menyaring daftar saran dengan benar", async () => {
    const fetchSuggestions = (query, callback) => {
      callback(
        SUGGESTIONS.filter((s) =>
          s.display.toLowerCase().includes(query.toLowerCase()),
        ),
      );
    };
    await render(<Basic data={fetchSuggestions} />);
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");

    await act(async () => {
      await user.type(textarea, "@Be");
    });

    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Alpha" }),
    ).not.toBeInTheDocument();
  });

  it("memilih saran via klik menyisipkan markup mentah ke value onChange, dan menampilkan hasil displayTransform di textarea", async () => {
    let lastValue = null;
    await render(
      <Basic
        displayTransform={(_id, display) => `@${display}`}
        onChangeSpy={(_e, value) => {
          lastValue = value;
        }}
      />,
    );
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");

    await act(async () => {
      await user.type(textarea, "@Al");
    });
    const option = screen.getByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(option);
    });

    // value "mentah" (dikirim ke onChange, dipakai sebagai source of truth di
    // form) memakai markup penuh "@[display](id)" ...
    expect(lastValue).toBe("@[Alpha](1)");
    // ... sedangkan yang tampil ke user di textarea sudah lewat displayTransform.
    expect(textarea).toHaveValue("@Alpha");
  });

  it("singleLine: menekan Enter TIDAK menyisipkan newline ke value", async () => {
    await render(<Basic singleLine placeholder="Subjek" />);
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Subjek");

    await act(async () => {
      await user.type(input, "a{Enter}b");
    });

    expect(input).toHaveValue("ab");
  });

  it("multi-line (default): menekan Enter menyisipkan newline ke value", async () => {
    await render(<Basic />);
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");

    await act(async () => {
      await user.type(textarea, "a{Enter}b");
    });

    expect(textarea).toHaveValue("a\nb");
  });
});

describe("Mention -- dokumentasi bug: defaultProps function component tidak berlaku di React 19", () => {
  // BUG (lihat bugFindings): react-mentions@4.4.10 mendefinisikan `Mention`
  // sebagai FUNCTION component dan menempelkan default lewat
  // `Mention.defaultProps = { trigger: '@', markup: '@[__display__](__id__)',
  // displayTransform: ... }` (node_modules/react-mentions/dist/
  // react-mentions.cjs.dev.js sekitar baris 2165). React 19 SUDAH TIDAK
  // menerapkan static defaultProps untuk function component (hanya class
  // component yang masih didukung -- MentionsInput aman karena dia class
  // component). Akibatnya, memakai <Mention> tanpa menyertakan displayTransform
  // secara eksplisit membuat displayTransform bernilai undefined saat runtime,
  // dan proses "pilih saran" (klik/Enter pada opsi) crash dengan
  // "TypeError: displayTransform is not a function".
  //
  // Pola PERSIS ini ada di produksi: resources/js/Pages/Core/Components/
  // EmailSendDialog.jsx baris ~247-251 --
  //   <Mention markup="__id__" trigger="@" data={fetchResolvedFieldsForSubject} />
  // -- TIDAK menyertakan displayTransform. Artinya field subjek di dialog
  // "Kirim Email" akan crash begitu user klik salah satu saran mention.
  // Solusi disarankan: tambahkan `displayTransform={(id, display) => display ?? id}`
  // (atau transform sesuai kebutuhan) secara eksplisit pada Mention tsb --
  // JANGAN mengandalkan default bawaan react-mentions selama masih di React 19.
  it("klik saran pada <Mention> tanpa displayTransform eksplisit throw TypeError (dokumentasi behavior saat ini, bukan bug di Mention.jsx)", async () => {
    let capturedError = null;
    const onWindowError = (e) => {
      capturedError = e.error ?? new Error(e.message);
      e.preventDefault();
    };
    window.addEventListener("error", onWindowError);

    try {
      // markup diisi eksplisit (kalau tidak, render itu sendiri sudah crash
      // lebih dulu -- root cause-nya sama: defaultProps function component
      // tidak berlaku). displayTransform SENGAJA tidak diisi, meniru persis
      // pola di EmailSendDialog.jsx.
      await render(<Basic displayTransform={undefined} />);
      const user = userEvent.setup();
      const textarea = screen.getByPlaceholderText("Ketik @ untuk mention");

      await act(async () => {
        await user.type(textarea, "@Al");
      });
      const option = screen.getByRole("option", { name: "Alpha" });

      await act(async () => {
        await user.click(option);
      });
    } finally {
      window.removeEventListener("error", onWindowError);
    }

    expect(capturedError).toBeInstanceOf(TypeError);
    expect(capturedError.message).toBe("displayTransform is not a function");
  });
});
