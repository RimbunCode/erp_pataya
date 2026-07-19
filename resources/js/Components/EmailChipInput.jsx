import React, { useState } from "react";

import { Button } from "@/Components/ui/button";
import { InputWrapper } from "@/Components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Input teks bebas untuk kumpulan alamat email — ketik alamat, tekan
 * Enter/koma/Tab untuk mengubahnya menjadi chip dengan tombol hapus.
 * Murni free-text (bukan search-to-server seperti Tags.jsx), nilai
 * disimpan sebagai string[] bukan string dipisah-koma.
 * @param {object} props
 * @param {string[]} [props.value] Kumpulan alamat email terpilih.
 * @param {(value: string[]) => void} [props.onValueChange]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export default function EmailChipInput({
  value = [],
  onValueChange,
  placeholder,
  disabled,
  className,
}) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const commitDraft = () => {
    const candidate = draft.trim().replace(/,$/, "");
    if (!candidate) {
      setDraft("");
      return;
    }
    if (!isValidEmail(candidate)) {
      setInvalid(true);
      return;
    }
    if (!value.includes(candidate)) {
      onValueChange?.([...value, candidate]);
    }
    setDraft("");
    setInvalid(false);
  };

  const removeChip = (email) => {
    onValueChange?.(value.filter((v) => v !== email));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        commitDraft();
      }
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeChip(value[value.length - 1]);
    }
  };

  return (
    <InputWrapper
      className={cn("flex-wrap h-auto min-h-8 py-1.5 gap-1.5", className)}
    >
      {value.map((email) => (
        <div
          key={email}
          className="flex items-center px-2 py-0.5 text-sm rounded-md gap-x-1.5 bg-muted-foreground/10"
        >
          <span>{email}</span>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full p-0! m-0! w-auto h-auto"
              size="icon"
              onClick={() => removeChip(email)}
            >
              <X className="size-3.5!" />
            </Button>
          )}
        </div>
      ))}
      <input
        data-slot="input"
        type="text"
        value={draft}
        disabled={disabled}
        placeholder={value.length === 0 ? placeholder : ""}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        className={cn(
          "flex-1 min-w-24 bg-transparent outline-none text-sm",
          invalid && "text-destructive",
        )}
      />
    </InputWrapper>
  );
}
