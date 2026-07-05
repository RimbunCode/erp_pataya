import LinkModel from "@/Components/LinkModel";
import AppLayout from "@/Layouts/AppLayout";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { useState } from "react";

export default function LinkModelTest() {
  const [permission, setPermission] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [withInput, setWithInput] = useState("*");
  const [fieldsInput, setFieldsInput] = useState("*");

  const modelClass = permission?.model ?? null;

  const withArray = withInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fieldsArray = fieldsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-8 p-8">
        <h1 className="text-2xl font-bold">LinkModel Test Page</h1>

        {/* Field 1: PermissionLinkModel — pilih model */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">
            1. Pilih Permission (sebagai model selector)
          </label>
          <PermissionLinkModel
            value={permission}
            onValueChange={(val) => {
              setPermission(val);
              setSelectedItem(null);
            }}
            placeholder="Pilih permission / model..."
            fields={["model"]}
            cache={false}
          />
          {permission && (
            <pre className="rounded bg-muted p-3 text-xs">
              {JSON.stringify(permission, null, 2)}
            </pre>
          )}
        </section>

        {/* Konfigurasi with & fields */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">
            2. Konfigurasi with & fields (comma-separated)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                with (relasi, contoh: city,branches)
              </span>
              <input
                className="w-full rounded border px-3 py-1.5 text-sm font-mono"
                placeholder="city, branches, ..."
                value={withInput}
                onChange={(e) => {
                  setWithInput(e.target.value);
                  setSelectedItem(null);
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                fields (kolom, contoh: code,name,city_id)
              </span>
              <input
                className="w-full rounded border px-3 py-1.5 text-sm font-mono"
                placeholder="code, name, ..."
                value={fieldsInput}
                onChange={(e) => {
                  setFieldsInput(e.target.value);
                  setSelectedItem(null);
                }}
              />
            </div>
          </div>
        </section>

        {/* Field 3: LinkModel — model dari value PermissionLinkModel */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">
            3. LinkModel (model dari Permission terpilih)
          </label>
          <LinkModel
            disabled={!modelClass}
            model={modelClass}
            value={selectedItem}
            onValueChange={setSelectedItem}
            placeholder={
              modelClass
                ? `Cari dari ${modelClass}...`
                : "Pilih permission dulu..."
            }
            with={withArray}
            fields={fieldsArray}
            limit={15}
          />
        </section>

        {/* Display detail item terpilih */}
        {selectedItem && (
          <section className="space-y-2">
            <label className="text-sm font-semibold">
              4. Detail item terpilih
            </label>
            <div className="grid grid-cols-2 gap-2 rounded border p-4 text-sm">
              {Object.entries(selectedItem).map(([key, val]) => (
                <div key={key} className="contents">
                  <span className="font-mono text-muted-foreground">{key}</span>
                  <span className="break-all">
                    {typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val ?? "—")}
                  </span>
                </div>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Raw JSON
              </summary>
              <pre className="mt-2 rounded bg-muted p-3">
                {JSON.stringify(selectedItem, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
