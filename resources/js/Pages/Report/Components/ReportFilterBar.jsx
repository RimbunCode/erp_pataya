import { router } from "@inertiajs/react";

import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

// Radix Select tidak menerima nilai kosong, jadi "semua" memakai sentinel ini.
const ALL_OPTION = "__all__";

// Bar filter dasar laporan (spec Req 2). Setiap perubahan langsung memuat ulang
// halaman lewat Inertia. Semua kunci dikirim, termasuk yang kosong, supaya
// ReportFilterStore memperlakukannya sebagai filter eksplisit dan menimpa nilai
// lama di session.
export default function ReportFilterBar({ fields = [], values = {} }) {
  if (fields.length === 0) {
    return null;
  }

  function change(key, value) {
    const next = {};
    for (const field of fields) {
      next[field.key] = field.key === key ? value : (values[field.key] ?? "");
    }

    router.get(window.location.pathname, next, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
      {fields.map((field) => {
        const id = `report-filter-${field.key}`;
        const current = values[field.key] ?? "";

        if (field.type === "date") {
          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                type="date"
                value={current}
                onChange={(event) => change(field.key, event.target.value)}
              />
            </div>
          );
        }

        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{field.label}</Label>
            <Select
              value={current === "" ? ALL_OPTION : current}
              onValueChange={(value) =>
                change(field.key, value === ALL_OPTION ? "" : value)
              }
            >
              <SelectTrigger id={id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>Semua</SelectItem>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
