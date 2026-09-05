import DeskMenuItemManager from "@/Pages/Core/Desk/DeskMenuItemManager";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import ColorInput from "@/Components/ColorInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import IconPicker from "@/Components/IconPicker";
import { Input } from "@/Components/ui/input";
import { cn } from "@/lib/utils";
import { getDeskColorStyle, resolveIcon } from "@/lib/deskIcons";
import { memo, useMemo } from "react";
import { usePage } from "@inertiajs/react";

// Preview live persis visual DeskCardVisual (DeskList.jsx) — biar user lihat
// bentuk icon Desk-nya di grid /desks SEBELUM disimpan, tanpa perlu bolak-
// balik save+reload. Nama fallback "Desk" saat data.name masih kosong,
// supaya preview tidak pernah tampak "hilang" saat user baru mulai isi form.
function DeskPreview({ name, icon, backgroundColor, foregroundColor }) {
  const { className: colorClassName, style: colorStyle } = getDeskColorStyle({
    background_color: backgroundColor,
    foreground_color: foregroundColor,
  });

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4">
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-2xl [&>svg]:size-7",
          colorClassName,
        )}
        style={colorStyle}
      >
        {resolveIcon(icon)}
      </span>
      <span className="text-sm font-medium">{name || "Desk"}</span>
    </div>
  );
}

// Satu kolom polymorphic (User ATAU Role) via AssignableLinkModel — value per
// row adalah object {id, type, name} langsung dari model Assignable (view
// union users+roles), bukan lagi 2 kolom terpisah (Select tipe + LinkModel).
export function NestedDeskAssignableFormTable({
  value,
  onChange,
  disabled,
  className,
}) {
  const nestedColumns = useMemo(
    () => [
      {
        name: "assignable",
        title: "Role / User",
        required: true,
        cell({ data, setData, attributes }) {
          return (
            <AssignableLinkModel
              value={data}
              onValueChange={(val) => setData("assignable", val)}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <FormTable
      name="DeskAssignables"
      label="Bagikan ke Role/User"
      className={cn("mt-2", className)}
      columns={nestedColumns}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    />
  );
}

export default memo(function Form() {
  const { data, setData, disabled } = useFormPage();
  const { canShare = false, hasWritePermission = false } = usePage().props;
  const isSystemDesk = data.type === "system";
  const isShared = data.is_personal_only === false;

  return (
    <FormPageContent title="Detail Desk" value="desk_detail">
      <div className="grid pt-2 gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <FormInput label="Nama" required name="name">
              <Input
                value={data.name ?? ""}
                onChange={(e) => setData("name", e.target.value)}
              />
            </FormInput>
            <FormInput label="Icon" required name="icon">
              <IconPicker
                value={data.icon}
                onValueChange={(val) => setData("icon", val)}
                disabled={disabled}
              />
            </FormInput>
            <FormInput label="Warna Latar" name="background_color">
              <ColorInput
                value={data.background_color ?? ""}
                onValueChange={(val) => setData("background_color", val)}
              />
            </FormInput>
            <FormInput label="Warna Teks/Icon" name="foreground_color">
              <ColorInput
                value={data.foreground_color ?? ""}
                onValueChange={(val) => setData("foreground_color", val)}
              />
            </FormInput>
          </div>
          <div className="grid pt-4 gap-x-4 gap-y-4 md:grid-cols-2">
            {/* Kolom kiri: Jadikan Default + Nonaktifkan Desk. Kolom kanan:
                Bagikan ke Role/User + Bagikan ke semua — masing2 di <div>
                kolom SENDIRI (bukan flow 1 grid) supaya posisi kolom TIDAK
                geser tergantung checkbox mana yg tampil (mis. Nonaktifkan
                Desk disembunyikan krn user tanpa Permission Write). */}
            <div className="flex flex-col gap-4">
              <FormCheckbox
                label="Jadikan Default"
                description="Berlaku personal untuk akun Anda sendiri — tidak mengubah desk default user lain."
                checked={data.is_default ?? data.isDefault ?? false}
                onCheckedChange={(val) => setData("is_default", val)}
                readOnly={disabled}
              />
              {/* Requirement 8 AC 6: "Nonaktifkan Desk" relevan utk KEDUA
                  tipe Desk, tapi HANYA utk pemegang Permission Write. */}
              {hasWritePermission && (
                <FormCheckbox
                  label="Nonaktifkan Desk"
                  description="Menyembunyikan Desk ini dari grid /desks tanpa menghapus data atau pengaturannya — bisa diaktifkan lagi kapan saja."
                  checked={data.is_disabled ?? false}
                  onCheckedChange={(val) => setData("is_disabled", val)}
                  readOnly={disabled}
                />
              )}
            </div>
            {/* Requirement 8 AC 2: konsep personal/shared/assignable HANYA
                relevan utk Desk Custom — Desk System selalu visible via akses
                model, bukan lewat assignable. */}
            {!isSystemDesk && canShare && (
              <div className="flex flex-col gap-4">
                <FormCheckbox
                  label="Bagikan ke Role/User"
                  description="Jika nonaktif, Desk ini bersifat pribadi — hanya Anda (pembuat) yang bisa melihatnya."
                  checked={isShared}
                  onCheckedChange={(val) => setData("is_personal_only", !val)}
                  readOnly={disabled}
                />
                {isShared && (
                  <FormCheckbox
                    label="Bagikan ke semua User/Role"
                    description="Desk ini terlihat oleh SEMUA User/Role — daftar Role/User spesifik di bawah jadi tidak berlaku."
                    checked={data.is_shared_all ?? false}
                    onCheckedChange={(val) => setData("is_shared_all", val)}
                    readOnly={disabled}
                  />
                )}
              </div>
            )}
          </div>
        </div>
        <DeskPreview
          name={data.name}
          icon={data.icon}
          backgroundColor={data.background_color}
          foregroundColor={data.foreground_color}
        />
      </div>

      {!isSystemDesk && canShare && isShared && !data.is_shared_all && (
        <NestedDeskAssignableFormTable
          value={data.assignables ?? []}
          onChange={(val) => setData("assignables", val)}
          disabled={disabled}
          className="mt-4"
        />
      )}

      <FormInput label="Menu" name="menu_items" className="mt-4">
        <DeskMenuItemManager
          value={data.menu_items ?? []}
          onChange={(val) => setData("menu_items", val)}
          disabled={disabled}
        />
      </FormInput>
    </FormPageContent>
  );
});
