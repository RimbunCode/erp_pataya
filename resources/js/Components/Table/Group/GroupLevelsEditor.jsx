// GroupLevelsEditor — panel Group by berupa checkbox berurutan (spec
// datatable2-group-tree, Requirement 11). Satu komponen dipakai di TIGA tempat
// supaya kontrak `Groups` tak bercabang: kolom Group by SearchPanel, popover
// chip `group` (ChipEditor), dan field Group by form Filter Templates.
//
//   ☑ ⋮⋮ Kategori
//   ☑ ⋮⋮ Tgl Order   [Bulan ▾]   ← aktif: urutan = nesting, bisa di-drag
//   ────────────────────────────  ← divider (hanya bila ada aktif DAN non-aktif)
//   ☐ Customer                    ← non-aktif: klik = tambah sbg level terdalam
//
// Controlled & presentasional (pola ChipEditor): tak tahu state/URL/saved
// filter, hanya melapor lewat `onChange(Groups)`; parent yang memutuskan.
//
// Jebakan yang pernah kena (memory proyek): JANGAN `<label htmlFor>` + kontrol
// native -- browser mengirim klik sintetis kedua ke kontrol (double-fire),
// tak terlihat di jsdom. Baris = SATU target klik (`role="checkbox"`);
// `ui/checkbox` di dalamnya hanya visual (aria-hidden, tabIndex -1,
// pointer-events-none) sehingga satu klik = satu toggle.

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Checkbox } from "@/Components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { cn } from "@/lib/utils";
import {
  DATE_GROUP_GRANULARITIES,
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS,
  MAX_GROUP_LEVELS,
  isDateGroupType,
  isNumberGroupType,
  moveGroupLevel,
  normalizeGroupLevels,
  setLevelOption,
  toggleGroupLevel,
} from "./groupLevels";

const rowClass = "flex items-center gap-1 rounded-md px-1 hover:bg-accent";
const toggleClass =
  "flex flex-1 min-w-0 items-center gap-2 py-1 px-1 text-sm text-left rounded-md cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Satu-satunya cara toggle: klik ATAU Spasi/Enter (role="checkbox" custom
// butuh keyboard sendiri, tak seperti <input type="checkbox">).
const toggleProps = (checked, disabled, label, onToggle) => ({
  role: "checkbox",
  "aria-checked": checked,
  "aria-disabled": disabled || undefined,
  "aria-label": label,
  tabIndex: disabled ? -1 : 0,
  onClick: () => !disabled && onToggle(),
  onKeyDown: (event) => {
    if (disabled) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onToggle();
    }
  },
});

// Pilihan granularity (date) / range (number) SATU level -- tiap level punya
// opsinya sendiri, jadi tak ada lagi deretan tombol bersama seperti GroupPicker lama.
function LevelOption({ level, column, onChange, t }) {
  if (isDateGroupType(column?.type)) {
    return (
      <Select
        value={level.granularity ?? "month"}
        onValueChange={(granularity) => onChange({ granularity })}
      >
        <SelectTrigger
          className="w-fit! h-7 gap-x-1 py-0! px-2 text-xs"
          aria-label={t("core.datatable.group_levels.granularity")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_GROUP_GRANULARITIES.map((granularity) => (
            <SelectItem key={granularity} value={granularity}>
              {t(`core.datatable.granularity.${granularity}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (isNumberGroupType(column?.type)) {
    const rangeOptions =
      column?.groupRangeOptions ?? DEFAULT_NUMBER_GROUP_RANGE_OPTIONS;
    return (
      <Select
        value={`${level.range ?? rangeOptions[0]}`}
        onValueChange={(range) => onChange({ range: Number(range) })}
      >
        <SelectTrigger
          className="w-fit! h-7 gap-x-1 py-0! px-2 text-xs"
          aria-label={t("core.datatable.group_range")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {rangeOptions.map((size) => (
            <SelectItem key={size} value={`${size}`}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return null;
}

function ActiveRow({ level, label, column, onToggle, onOptionChange, t }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.column });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(rowClass, isDragging && "bg-accent z-10 shadow-sm")}
    >
      <button
        type="button"
        className="p-1 cursor-grab touch-none text-muted-foreground"
        aria-label={t("core.datatable.group_levels.drag_handle")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div
        {...toggleProps(true, false, label, onToggle)}
        className={toggleClass}
      >
        <Checkbox
          checked
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none"
        />
        <span className="truncate">{label}</span>
      </div>
      <LevelOption
        level={level}
        column={column}
        onChange={onOptionChange}
        t={t}
      />
    </li>
  );
}

function InactiveRow({ label, disabled, onToggle }) {
  return (
    <li className={cn(rowClass, "pl-6", disabled && "opacity-50")}>
      <div
        {...toggleProps(false, disabled, label, onToggle)}
        className={toggleClass}
      >
        <Checkbox
          checked={false}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none"
        />
        <span className="truncate">{label}</span>
      </div>
    </li>
  );
}

/**
 * @param {object} root0
 * @param {Object<string, object>} root0.columns peta nama -> node kolom (tipe, groupRangeOptions)
 * @param {Array<{value: string, label: string}>} root0.options SEMUA kolom groupable (TANPA sentinel "Tidak ada" -- "tidak ada" = Groups kosong)
 * @param {Array} root0.value `Groups` aktif (urutan = nesting)
 * @param {(groups: Array) => void} root0.onChange
 * @param {number} [root0.max] batas level (default MAX_GROUP_LEVELS)
 * @param {string} [root0.className] lebar/layout wadah -- default `w-64`; SearchPanel (kolom grid) WAJIB override ke `w-full` (`w-64` FIXED memaksa kolom grid melebihi jatahnya)
 */
export default function GroupLevelsEditor({
  columns,
  options,
  value,
  onChange,
  max = MAX_GROUP_LEVELS,
  className,
}) {
  const { t } = useLaravelReactI18n();
  const levels = normalizeGroupLevels(value);
  const labelOf = new Map(
    options.map((option) => [option.value, option.label]),
  );
  const activeColumns = levels.map((level) => level.column);
  const inactive = options.filter(
    (option) => !activeColumns.includes(option.value),
  );
  const atMax = levels.length >= max;

  const sensors = useSensors(
    // Jarak minimal supaya klik biasa di handle tak dianggap drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onChange(
      moveGroupLevel(
        levels,
        activeColumns.indexOf(active.id),
        activeColumns.indexOf(over.id),
      ),
    );
  };

  return (
    <div className={cn("flex flex-col min-w-0", className ?? "w-64")}>
      {/* Daftar polos TANPA kotak cari sendiri -- kolom groupable per model
          selalu sedikit (opt-in) & pencarian sudah tugas Search Bar. */}
      {levels.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeColumns}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-0.5 p-1">
              {levels.map((level) => (
                <ActiveRow
                  key={level.column}
                  level={level}
                  label={labelOf.get(level.column) ?? level.column}
                  column={columns?.[level.column]}
                  onToggle={() =>
                    onChange(toggleGroupLevel(levels, level.column))
                  }
                  onOptionChange={(patch) =>
                    onChange(setLevelOption(levels, level.column, patch))
                  }
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {levels.length > 0 && inactive.length > 0 && (
        <div
          role="separator"
          className="mx-2 my-1 border-t border-muted-foreground/20"
        />
      )}
      {inactive.length > 0 && (
        <ul className="flex flex-col gap-0.5 p-1 max-h-56 overflow-y-auto">
          {inactive.map((option) => (
            <InactiveRow
              key={option.value}
              label={option.label}
              disabled={atMax}
              onToggle={() =>
                onChange(
                  toggleGroupLevel(
                    levels,
                    option.value,
                    columns?.[option.value],
                  ),
                )
              }
            />
          ))}
        </ul>
      )}
      {atMax && inactive.length > 0 && (
        <p className="px-3 py-1 text-xs text-muted-foreground">
          {t("core.datatable.group_levels.max", { max })}
        </p>
      )}
    </div>
  );
}
