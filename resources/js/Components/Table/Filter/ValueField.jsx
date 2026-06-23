import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/Components/ui/button";
import Checkbox from "@/Components/Checkbox";
import DateSelector from "./DateSelector";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import MultiSelect from "@/Components/MultiSelect";
import NestedSelect from "@/Components/NestedSelect";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import Select from "@/Components/Select";
import { columnHasOptions, getOperators } from "./operators";
import { columnTypeCategory } from "./columnRef";
import { useLaravelReactI18n } from "laravel-react-i18n";
import NumberInput from "@/Components/NumberInput";

/**
 * ValueField — merender input value yang sesuai dengan (column.type, operator).
 * Komponen yang dirender ditentukan oleh metadata `valueInput` pada operator
 * (lihat operators.js), sehingga selalu sinkron dengan daftar operator.
 *
 * Props:
 *   column        : node kolom kiri { type, related, typeRelation, options, ... }
 *   operator      : string operator aktif
 *   value         : nilai saat ini
 *   onChange      : (value) => void
 *   mode          : "value" | "column" (default "value")
 *   columnOptions : tree kolom (untuk picker kolom kanan di mode column)
 *   fetchColumnChildren : (node) => Promise<children> (lazy-load kolom relasi)
 * @param root0
 * @param root0.column
 * @param root0.operator
 * @param root0.value
 * @param root0.onChange
 * @param root0.mode
 * @param root0.columnOptions
 * @param root0.fetchColumnChildren
 */
export default function ValueField({
  column,
  operator,
  value,
  onChange,
  mode = "value",
  columnOptions = [],
  fetchColumnChildren,
}) {
  const { t } = useLaravelReactI18n();

  const valueInput = useMemo(() => {
    if (!column?.type || !operator) return null;
    const ops = getOperators(column.type, {
      typeRelation: column.typeRelation,
      hasOptions: columnHasOptions(column),
      mode,
    });
    return ops[operator]?.valueInput ?? null;
  }, [column?.type, column?.typeRelation, column?.options, operator, mode]);

  // Picker kolom kanan: hanya kolom type-compatible dgn kolom kiri; node
  // relasi tetap ditampilkan agar bisa drill-down ke kolom anaknya.
  const refColumnOptions = useMemo(() => {
    if (mode !== "column" || !column?.type) return [];
    const leftCat = columnTypeCategory(column.type);
    const filterTree = (nodes) =>
      (nodes ?? [])
        .map((node) => {
          const isRelation =
            node.type === "relation" || node.type === "relations";
          if (isRelation) {
            return { ...node, children: filterTree(node.children) };
          }
          return columnTypeCategory(node.type) === leftCat ? node : null;
        })
        .filter(Boolean);
    return filterTree(columnOptions);
  }, [mode, column?.type, columnOptions]);

  const options = useMemo(() => {
    const opts = column?.options ?? [];
    const valueTrans = column?.valueTrans;
    // Label option: pakai `valueTrans` (prefix lang key, mis. "status" →
    // t("status.<value>")) bila tersedia; jika tidak, pakai nilai mentah.
    const labelOf = (val) =>
      valueTrans ? t(`${valueTrans}.${val}`) : `${val}`;
    return (Array.isArray(opts) ? opts : Object.values(opts)).map((o) =>
      typeof o === "string" || typeof o === "number"
        ? { value: o, label: labelOf(o) }
        : { ...o, label: o.label ?? labelOf(o.value) },
    );
  }, [column?.options, column?.valueTrans, t]);

  if (!valueInput || valueInput === "none") return null;

  switch (valueInput) {
    case "text":
      return (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );

    case "currency":
      return (
        <NumberInput
          className="text-left"
          value={value}
          onValueChange={onChange}
        />
      );

    case "currency2":
      return (
        <RangePair
          render={(v, set) => (
            <NumberInput className="text-left" value={v} onValueChange={set} />
          )}
          value={value}
          onChange={onChange}
        />
      );

    case "time":
      return (
        <Input
          type="time"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-32"
        />
      );

    case "time2":
      return (
        <RangePair
          render={(v, set) => (
            <Input
              type="time"
              value={v ?? ""}
              onChange={(e) => set(e.target.value)}
              className="w-32"
            />
          )}
          value={value}
          onChange={onChange}
        />
      );

    case "checkbox":
      return (
        <div className="flex items-center">
          <Checkbox
            checked={value === true || value === "true"}
            onChange={(e) => onChange(e.target.checked)}
          />
        </div>
      );

    case "select":
      return (
        <Select
          value={value ?? ""}
          onValueChange={onChange}
          options={options}
          placeholder={t("core.datatable.filter.select_value", {
            name: column?.title ?? "",
          })}
        />
      );

    case "multiselect":
      // Untuk enum/formStatus pakai MultiSelect berbasis options; untuk
      // tipe bebas (string/number) pakai multi-grow input.
      if (options.length > 0) {
        return (
          <MultiSelect
            value={Array.isArray(value) ? value : []}
            onValueChange={onChange}
            options={options}
          />
        );
      }
      return (
        <MultiGrow
          value={value}
          onChange={onChange}
          render={(v, set) => (
            <Input value={v ?? ""} onChange={(e) => set(e.target.value)} />
          )}
        />
      );

    case "linkmodel":
      // Simpan objek record penuh agar LinkModel (controlled) dapat
      // menampilkan label & validasi; backend (FilterEvaluator::scalarId)
      // mengekstrak `.id` untuk query.
      return (
        <LinkModel
          model={column?.related}
          value={value ?? null}
          onValueChange={(rec) => onChange(rec ?? null)}
        />
      );

    case "linkmodelMulti":
      return (
        <MultiGrow
          value={value}
          onChange={onChange}
          isFilled={(v) => v != null && v?.id != null}
          render={(v, set) => (
            <LinkModel
              model={column?.related}
              value={v ?? null}
              onValueChange={(rec) => set(rec ?? null)}
            />
          )}
        />
      );

    case "morph":
      return <MorphField column={column} value={value} onChange={onChange} />;

    case "morphMulti":
      return (
        <MultiGrow
          value={value}
          onChange={onChange}
          isFilled={(v) => v != null && v?.id != null}
          render={(v, set) => (
            <MorphField column={column} value={v} onChange={set} embedded />
          )}
        />
      );

    case "dateselector":
      return (
        <DateSelector
          type={column?.type === "datetime" ? "datetime" : "date"}
          value={value}
          yearRange={12}
          maxYear={new Date().getFullYear() + 2}
          onValueChange={onChange}
        />
      );

    case "columnref": {
      // value = { kind: "column", ref: <string> }
      const ref = typeof value?.ref === "string" ? value.ref : "";
      return (
        <ColumnRefPicker
          options={refColumnOptions}
          fetchChildren={fetchColumnChildren}
          value={ref}
          onChange={(r) => onChange({ kind: "column", ref: r })}
          placeholder={t("core.datatable.filter.select_column")}
        />
      );
    }

    case "columnrefMulti": {
      // value = { kind: "column", ref: <string[]> }
      const refs = Array.isArray(value?.ref) ? value.ref : [];
      return (
        <MultiGrow
          value={refs}
          onChange={(arr) => onChange({ kind: "column", ref: arr })}
          render={(v, set) => (
            <ColumnRefPicker
              options={refColumnOptions}
              fetchChildren={fetchColumnChildren}
              value={v ?? ""}
              onChange={set}
              placeholder={t("core.datatable.filter.select_column")}
            />
          )}
        />
      );
    }

    case "columnref2": {
      // value = { kind: "column", ref: [a, b] }
      const refs = Array.isArray(value?.ref) ? value.ref : [null, null];
      return (
        <RangePair
          value={refs}
          onChange={(arr) => onChange({ kind: "column", ref: arr })}
          render={(v, set) => (
            <ColumnRefPicker
              options={refColumnOptions}
              fetchChildren={fetchColumnChildren}
              value={v ?? ""}
              onChange={set}
              placeholder={t("core.datatable.filter.select_column")}
            />
          )}
        />
      );
    }

    default:
      return (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

/**
 * Picker satu kolom kanan (mode column) — NestedSelect dgn lazy-load relasi.
 * @param root0
 * @param root0.options
 * @param root0.fetchChildren
 * @param root0.value
 * @param root0.onChange
 * @param root0.placeholder
 */
function ColumnRefPicker({
  options,
  fetchChildren,
  value,
  onChange,
  placeholder,
}) {
  return (
    <NestedSelect
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      className="min-w-[10rem]"
      fetchChildren={fetchChildren}
    />
  );
}

/**
 * Dua input berdampingan untuk operator between. value = [a, b].
 * @param root0
 * @param root0.render
 * @param root0.value
 * @param root0.onChange
 */
function RangePair({ render, value, onChange }) {
  const arr = Array.isArray(value) ? value : [null, null];
  const setAt = (i, v) => {
    const next = [...arr];
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="flex items-center gap-1">
      {render(arr[0], (v) => setAt(0, v))}
      <span className="text-muted-foreground text-sm">—</span>
      {render(arr[1], (v) => setAt(1, v))}
    </div>
  );
}

/**
 * MultiGrow — daftar field yang otomatis bertambah saat field terakhir
 * terisi; tiap field punya tombol hapus. value = array.
 * @param root0
 * @param root0.value
 * @param root0.onChange
 * @param root0.render
 * @param root0.isFilled
 */
function MultiGrow({ value, onChange, render, isFilled }) {
  const items = Array.isArray(value) && value.length > 0 ? value : [null];
  // Predikat "terisi" — bisa di-override untuk value objek (mis. record LinkModel).
  const filled = isFilled ?? ((v) => v !== null && v !== "" && v !== undefined);

  const setAt = (i, v) => {
    const next = [...items];
    next[i] = v;
    // auto-append bila field terakhir terisi
    if (i === next.length - 1 && filled(v)) {
      next.push(null);
    }
    onChange(next.filter((x, idx) => idx === next.length - 1 || filled(x)));
  };

  const removeAt = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : []);
  };

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex-1">{render(item, (v) => setAt(i, v))}</div>
          {items.length > 1 && (
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={() => removeAt(i)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * MorphField — dua langkah untuk relasi morph: pilih morph type
 * (PermissionLinkModel) lalu pilih record (LinkModel dgn model dari step 1).
 * value = { type, id }.
 * @param root0
 * @param root0.column
 * @param root0._column
 * @param root0.value
 * @param root0.onChange
 */
function MorphField({ _column, value, onChange }) {
  const morphType = value?.type ?? null;

  return (
    <div className="flex items-center gap-1">
      <PermissionLinkModel
        value={value?.typeRecord ?? (morphType ? { id: morphType } : null)}
        onValueChange={(rec) =>
          onChange({
            type: rec?.model ?? rec?.id ?? null,
            typeRecord: rec ?? null,
            id: null,
            record: null,
          })
        }
      />
      <LinkModel
        model={morphType}
        value={value?.record ?? null}
        disabled={!morphType}
        onValueChange={(rec) =>
          onChange({
            type: morphType,
            typeRecord: value?.typeRecord ?? null,
            id: rec?.id ?? null,
            record: rec ?? null,
          })
        }
      />
    </div>
  );
}
