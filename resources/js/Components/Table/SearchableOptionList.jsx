import {
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/Components/ui/command";
import { Check } from "lucide-react";
import { highlightMatch } from "@/lib/highlightMatch";
import { useState } from "react";

// Filter substring case-insensitive utk prop `filter` pada <Command> pembungkus
// -- SELALU dipasang oleh pemanggil (Popover/Dialog), bukan di komponen ini,
// krn ownership <Command> beda-beda tergantung chrome (Popover vs Dialog).
export const searchableOptionFilter = (itemValue, search) =>
  itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;

// Isi list (CommandInput + CommandList), BUKAN pembungkus <Command> --
// supaya bisa dipasang baik di dalam Popover+Command (desktop) maupun
// Dialog+Command (mobile). State search dikelola lokal di sini; pemanggil
// via onValueChange bertanggung jawab menutup Popover/Dialog-nya sendiri.
export default function SearchableOptionList({
  options,
  value,
  onValueChange,
  searchPlaceholder,
  emptyMessage,
}) {
  const [search, setSearch] = useState("");
  return (
    <>
      <CommandInput
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {options.map((opt) => (
          <CommandItem
            key={opt.value}
            value={opt.label}
            onSelect={() => onValueChange(opt.value)}
          >
            {opt.value === value && <Check className="size-4 shrink-0" />}
            <span>{highlightMatch(opt.label, search)}</span>
          </CommandItem>
        ))}
      </CommandList>
    </>
  );
}
