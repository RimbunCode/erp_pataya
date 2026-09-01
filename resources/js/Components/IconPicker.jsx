import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { Component, useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Grid } from "react-window";
import { HelpCircle } from "lucide-react";
import { Input } from "@/Components/ui/input";
import { cn } from "@/lib/utils";
import * as lucideIcons from "lucide-react";

const ICON_NAMES = Object.keys(lucideIcons)
  .filter((name) => name.endsWith("Icon") && name !== "LucideIcon")
  .sort();

const COLUMN_COUNT = 6;
const CELL_SIZE = 40;

function IconCell({ columnIndex, rowIndex, style, names, value, onSelect }) {
  const index = rowIndex * COLUMN_COUNT + columnIndex;
  const name = names?.[index];
  if (!name) return <div style={style} />;

  const Icon = lucideIcons[name];
  const isSelected = name === value;

  return (
    <div style={style} className="p-0.5">
      <button
        type="button"
        title={name}
        onClick={() => onSelect(name)}
        className={cn(
          "flex size-full items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-input hover:bg-muted hover:text-foreground",
          isSelected && "border-primary bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4.5" />
      </button>
    </div>
  );
}

// react-window Grid pegang state scroll internalnya sendiri — kalau crash
// di tengah scroll cepat (belum ketemu root cause pasti, kemungkinan race
// internal library saat virtualized range dihitung ulang antar-frame),
// boundary ini mencegah crash itu merusak SELURUH form Desk, cuma grid-nya
// yg gagal tampil (fallback pesan) sampai popover ditutup+dibuka ulang.
const IconGridBoundary = class extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="w-full py-6 text-center text-sm text-muted-foreground">
          Gagal menampilkan grid icon. Tutup dan buka lagi picker ini.
        </p>
      );
    }
    return this.props.children;
  }
};
IconGridBoundary.displayName = "IconGridBoundary";

function IconGrid({ search, value, onSelect }) {
  const filteredNames = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return ICON_NAMES;
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(term));
  }, [search]);

  const rowCount = Math.ceil(filteredNames.length / COLUMN_COUNT);

  if (filteredNames.length === 0) {
    return (
      <p className="w-full py-6 text-center text-sm text-muted-foreground">
        Icon tidak ditemukan.
      </p>
    );
  }

  return (
    <IconGridBoundary resetKey={search}>
      <Grid
        key={search}
        cellComponent={IconCell}
        cellProps={{ names: filteredNames, value, onSelect }}
        columnCount={COLUMN_COUNT}
        columnWidth={CELL_SIZE}
        rowCount={rowCount}
        rowHeight={CELL_SIZE}
        overscanCount={4}
        style={{
          height: Math.min(rowCount * CELL_SIZE, 280),
          width: COLUMN_COUNT * CELL_SIZE,
        }}
      />
    </IconGridBoundary>
  );
}

// Popover + grid virtualized (react-window Grid) dari SELURUH lucide-react
// (~1930 icon, konvensi nama disamakan dgn deskIcons.jsx: suffix "Icon").
// Grid dipakai (bukan list) krn ~1930 icon dlm list 1-kolom terlalu tinggi
// discroll — kolom tetap (6) bikin picker lebih ringkas & cepat di-scan mata.
//
// variant="input" (default): text input BERPERAN sbg trigger — fokus/ketik
// langsung buka popover picker, ketikan jadi search term (dipakai field Icon
// Desk utama, value bisa string bebas termasuk nama custom di luar lucide).
// variant="button": tombol ikon polos tanpa text (dipakai row MenuItem,
// ringkas krn banyak row sekaligus) — search terpisah di dalam popover.
export default function IconPicker({
  value,
  onValueChange,
  disabled,
  variant = "input",
  ...inputProps
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const SelectedIcon = value ? lucideIcons[value] : null;

  function handleSelect(name) {
    onValueChange(name);
    setOpen(false);
    setSearch("");
  }

  if (variant === "button") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="size-8 shrink-0"
            title={value || "Pilih icon"}
          >
            {SelectedIcon ? (
              <SelectedIcon className="size-4.5" />
            ) : (
              <HelpCircle className="size-4.5 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Cari icon ..."
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <IconGrid search={search} value={value} onSelect={handleSelect} />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center [&>svg]:size-4 text-muted-foreground">
            {SelectedIcon ? <SelectedIcon /> : <HelpCircle />}
          </span>
          <Input
            {...inputProps}
            value={open ? search : (value ?? "")}
            onChange={(e) => {
              setSearch(e.target.value);
              onValueChange(e.target.value);
              if (!open) setOpen(true);
            }}
            onClick={() => {
              if (!open) {
                setSearch(value ?? "");
                setOpen(true);
              }
            }}
            disabled={disabled}
            className="pl-7"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <IconGrid search={search} value={value} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
