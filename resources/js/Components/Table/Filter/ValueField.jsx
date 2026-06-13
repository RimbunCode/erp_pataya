import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/Components/ui/button";
import Checkbox from "@/Components/Checkbox";
import CurrencyInput from "@/Components/CurrencyInput";
import DateSelector from "./DateSelector";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import MultiSelect from "@/Components/MultiSelect";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import Select from "@/Components/Select";
import { columnHasOptions, getOperators } from "./operators";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * ValueField — merender input value yang sesuai dengan (column.type, operator).
 * Komponen yang dirender ditentukan oleh metadata `valueInput` pada operator
 * (lihat operators.js), sehingga selalu sinkron dengan daftar operator.
 *
 * Props:
 *   column   : node kolom { type, related, typeRelation, options, ... }
 *   operator : string operator aktif
 *   value    : nilai saat ini
 *   onChange : (value) => void
 */
export default function ValueField({ column, operator, value, onChange }) {
  const { t } = useLaravelReactI18n();

  const valueInput = useMemo(() => {
    if (!column?.type || !operator) return null;
    const ops = getOperators(column.type, {
      typeRelation: column.typeRelation,
      hasOptions: columnHasOptions(column),
    });
    return ops[operator]?.valueInput ?? null;
  }, [column?.type, column?.typeRelation, column?.options, operator]);

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
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="m-1"
        />
      );

    case "currency":
      return (
        <CurrencyInput value={value} onValueChange={onChange} className="m-1" />
      );

    case "currency2":
      return (
        <RangePair
          render={(v, set) => (
            <CurrencyInput value={v} onValueChange={set} className="m-1" />
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
          className="m-1 w-32"
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
              className="m-1 w-32"
            />
          )}
          value={value}
          onChange={onChange}
        />
      );

    case "checkbox":
      return (
        <div className="m-1 flex items-center">
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
          className="m-1"
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
            className="m-1"
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
          className="m-1"
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
          onValueChange={onChange}
        />
      );

    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="m-1"
        />
      );
  }
}

/** Dua input berdampingan untuk operator between. value = [a, b]. */
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
    <div className="m-1 flex flex-col gap-1">
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
 */
function MorphField({ column, value, onChange }) {
  const morphType = value?.type ?? null;

  return (
    <div className="m-1 flex items-center gap-1">
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
