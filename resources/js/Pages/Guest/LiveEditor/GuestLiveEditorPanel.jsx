import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/Components/ui/sheet";
import TiptapFieldEditor from "@/Pages/Admin/LandingPageSettings/components/TiptapFieldEditor";
import { getByPath } from "@/lib/guestContentDraft";
import {
  ABOUT_CUSTOM_SECTIONS_PATH,
  ABOUT_STATS_PATH,
  CONTACT_ITEMS_PATH,
  getLiveEditorSections,
  HOME_BANNERS_PATH,
  HOME_CUSTOM_SECTIONS_PATH,
  HOME_IMAGE_FIELDS,
  HOME_TRUSTED_COMPANIES_PATH,
} from "@/lib/guestLiveEditorConfig";

import { useGuestLiveEditor } from "./GuestLiveEditorContext";

function BannersEditor() {
  const {
    draftContent,
    setFieldValue,
    addBanner,
    removeBanner,
    _uploadImage,
    _isUploadingImage,
  } = useGuestLiveEditor();

  const banners = getByPath(draftContent, HOME_BANNERS_PATH) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Manage Hero Banners</p>
        <button
          type="button"
          onClick={addBanner}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Add Banner
        </button>
      </div>

      {banners.map((_banner, index) => {
        const prefix = `${HOME_BANNERS_PATH}.${index}`;
        const mode = getByPath(draftContent, `${prefix}.mode`) ?? "full-edit";

        return (
          <div
            key={`banner-${index}`}
            className="rounded-xl border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">
                Banner {index + 1}
              </p>
              <button
                type="button"
                onClick={() => removeBanner(index)}
                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) =>
                    setFieldValue(`${prefix}.mode`, e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                >
                  <option value="full-edit">Full Edit</option>
                  <option value="image-only">Image Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Duration (ms)
                </label>
                <input
                  type="number"
                  value={getByPath(draftContent, `${prefix}.duration`) ?? 5000}
                  onChange={(e) =>
                    setFieldValue(`${prefix}.duration`, Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                />
              </div>
            </div>

            {mode === "image-only" ? (
              <div className="space-y-3">
                <ImageFieldCard
                  label="Banner Image"
                  path={`${prefix}.imageFileId`}
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Redirect URL
                  </label>
                  <input
                    type="text"
                    value={
                      getByPath(draftContent, `${prefix}.redirectUrl`) ?? ""
                    }
                    onChange={(e) =>
                      setFieldValue(`${prefix}.redirectUrl`, e.target.value)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                    placeholder="https://..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <TiptapFieldEditor
                  label="Badge"
                  value={getByPath(draftContent, `${prefix}.badge`)}
                  onChange={(val) => setFieldValue(`${prefix}.badge`, val)}
                />
                <TiptapFieldEditor
                  label="Title"
                  value={getByPath(draftContent, `${prefix}.title`)}
                  onChange={(val) => setFieldValue(`${prefix}.title`, val)}
                />
                <TiptapFieldEditor
                  label="Description"
                  value={getByPath(draftContent, `${prefix}.description`)}
                  onChange={(val) =>
                    setFieldValue(`${prefix}.description`, val)
                  }
                />
                <ImageFieldCard
                  label="Hero Image"
                  path={`${prefix}.heroImageFileId`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CustomSectionsEditor({ path }) {
  const { draftContent, setFieldValue, addCustomSection, removeCustomSection } =
    useGuestLiveEditor();

  const sections = getByPath(draftContent, path) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Custom Tiptap Sections</p>
        <button
          type="button"
          onClick={() => addCustomSection(path)}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Add Section
        </button>
      </div>

      {sections.map((_section, index) => {
        const prefix = `${path}.${index}`;
        return (
          <div
            key={`${path}-${index}`}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={getByPath(draftContent, `${prefix}.title`) ?? ""}
                onChange={(e) =>
                  setFieldValue(`${prefix}.title`, e.target.value)
                }
                className="bg-transparent text-xs font-black uppercase tracking-widest text-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeCustomSection(path, index)}
                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent"
              >
                Remove
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={Boolean(getByPath(draftContent, `${prefix}.enabled`))}
                onChange={(e) =>
                  setFieldValue(`${prefix}.enabled`, e.target.checked)
                }
              />
              Active
            </label>

            <TiptapFieldEditor
              label="Tagline"
              value={getByPath(draftContent, `${prefix}.tagline`)}
              onChange={(val) => setFieldValue(`${prefix}.tagline`, val)}
              placeholder="Tagline atau subtitle section..."
            />

            <TiptapFieldEditor
              label="Content"
              value={getByPath(draftContent, `${prefix}.content`)}
              onChange={(val) => setFieldValue(`${prefix}.content`, val)}
            />
          </div>
        );
      })}
    </div>
  );
}

function StatsEditor() {
  const { draftContent, setFieldValue, addStat, removeStat } =
    useGuestLiveEditor();
  const stats = getByPath(draftContent, ABOUT_STATS_PATH) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Manage Stats</p>
        <button
          type="button"
          onClick={addStat}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Add Stat
        </button>
      </div>
      {stats.map((_stat, index) => (
        <div
          key={`stat-${index}`}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-foreground">
              Stat {index + 1}
            </p>
            <button
              type="button"
              onClick={() => removeStat(index)}
              className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent"
            >
              Remove
            </button>
          </div>
          <TiptapFieldEditor
            label="Value"
            value={getByPath(
              draftContent,
              `${ABOUT_STATS_PATH}.${index}.value`,
            )}
            onChange={(val) =>
              setFieldValue(`${ABOUT_STATS_PATH}.${index}.value`, val)
            }
          />
          <TiptapFieldEditor
            label="Label"
            value={getByPath(
              draftContent,
              `${ABOUT_STATS_PATH}.${index}.label`,
            )}
            onChange={(val) =>
              setFieldValue(`${ABOUT_STATS_PATH}.${index}.label`, val)
            }
          />
        </div>
      ))}
    </div>
  );
}

function ContactItemsEditor() {
  const { draftContent, setFieldValue, addContactItem, removeContactItem } =
    useGuestLiveEditor();
  const items = getByPath(draftContent, CONTACT_ITEMS_PATH) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Contact Information</p>
        <button
          type="button"
          onClick={addContactItem}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Add Item
        </button>
      </div>
      {items.map((_item, index) => (
        <div
          key={`contact-${index}`}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <select
              value={getByPath(
                draftContent,
                `${CONTACT_ITEMS_PATH}.${index}.icon`,
              )}
              onChange={(e) =>
                setFieldValue(
                  `${CONTACT_ITEMS_PATH}.${index}.icon`,
                  e.target.value,
                )
              }
              className="bg-transparent text-xs font-black uppercase tracking-widest text-foreground focus:outline-none"
            >
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="address">Address</option>
            </select>
            <button
              type="button"
              onClick={() => removeContactItem(index)}
              className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent"
            >
              Remove
            </button>
          </div>
          <TiptapFieldEditor
            label="Label"
            value={getByPath(
              draftContent,
              `${CONTACT_ITEMS_PATH}.${index}.label`,
            )}
            onChange={(val) =>
              setFieldValue(`${CONTACT_ITEMS_PATH}.${index}.label`, val)
            }
          />
          <TiptapFieldEditor
            label="Value"
            value={getByPath(
              draftContent,
              `${CONTACT_ITEMS_PATH}.${index}.value`,
            )}
            onChange={(val) =>
              setFieldValue(`${CONTACT_ITEMS_PATH}.${index}.value`, val)
            }
          />
        </div>
      ))}
    </div>
  );
}

function ImageFieldCard({ label, path }) {
  const { draftContent, setFieldValue, uploadImage, isUploadingImage } =
    useGuestLiveEditor();
  const fileId = getByPath(draftContent, path);
  const imageUrl = fileId ? route("files.preview", fileId) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-foreground">
        {label}
      </p>

      <div className="w-full rounded-lg bg-muted border border-border overflow-hidden aspect-[16/9]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            No image selected
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="text-xs text-muted-foreground"
          disabled={isUploadingImage}
          onChange={async (event) => {
            const nextFile = event.target.files?.[0];
            if (!nextFile) {
              return;
            }

            const uploadedFile = await uploadImage(nextFile);
            if (uploadedFile?.id) {
              setFieldValue(path, uploadedFile.id);
            }

            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent disabled:opacity-40"
          disabled={isUploadingImage || !fileId}
          onClick={() => setFieldValue(path, null)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AdsEditor() {
  const {
    draftContent,
    setFieldValue,
    addAdItem,
    removeAdItem,
    uploadImage,
    isUploadingImage,
  } = useGuestLiveEditor();

  const adItems = getByPath(draftContent, "home.ads.items");
  const ads = Array.isArray(adItems) ? adItems : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Slot iklan dinamis. Default 1 slot.
        </p>
        <button
          type="button"
          onClick={addAdItem}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Add Slot
        </button>
      </div>

      {ads.map((_adItem, index) => {
        const prefix = `home.ads.items.${index}`;
        const imageFileId = getByPath(draftContent, `${prefix}.imageFileId`);
        const imageUrl = imageFileId
          ? route("files.preview", imageFileId)
          : null;

        return (
          <div
            key={`${prefix}-${index}`}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">
                Slot {index + 1}
              </p>
              <button
                type="button"
                onClick={() => removeAdItem(index)}
                disabled={ads.length <= 1}
                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent disabled:opacity-40"
              >
                Remove
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={Boolean(getByPath(draftContent, `${prefix}.enabled`))}
                onChange={(event) =>
                  setFieldValue(`${prefix}.enabled`, event.target.checked)
                }
              />
              Active
            </label>

            <TiptapFieldEditor
              label="Ad Title"
              value={getByPath(draftContent, `${prefix}.title`)}
              onChange={(nextDoc) => setFieldValue(`${prefix}.title`, nextDoc)}
            />

            <TiptapFieldEditor
              label="Ad Description"
              value={getByPath(draftContent, `${prefix}.description`)}
              onChange={(nextDoc) =>
                setFieldValue(`${prefix}.description`, nextDoc)
              }
            />

            <TiptapFieldEditor
              label="CTA Label"
              value={getByPath(draftContent, `${prefix}.ctaLabel`)}
              onChange={(nextDoc) =>
                setFieldValue(`${prefix}.ctaLabel`, nextDoc)
              }
            />

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Duration (ms)
              </label>
              <input
                type="number"
                value={getByPath(draftContent, `${prefix}.duration`) ?? 5000}
                onChange={(e) =>
                  setFieldValue(`${prefix}.duration`, Number(e.target.value))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-foreground">
                Destination URL
              </label>
              <input
                type="url"
                value={getByPath(draftContent, `${prefix}.url`) ?? ""}
                onChange={(event) =>
                  setFieldValue(`${prefix}.url`, event.target.value)
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                placeholder="https://example.com"
              />
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(
                    getByPath(draftContent, `${prefix}.openInNewTab`),
                  )}
                  onChange={(event) =>
                    setFieldValue(
                      `${prefix}.openInNewTab`,
                      event.target.checked,
                    )
                  }
                />
                Open in new tab
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-foreground">
                Ad Image
              </label>
              <div className="w-full rounded-lg bg-muted border border-border overflow-hidden aspect-[16/9]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Ad Slot ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    No image selected
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="text-xs text-muted-foreground"
                  disabled={isUploadingImage}
                  onChange={async (event) => {
                    const nextFile = event.target.files?.[0];
                    if (!nextFile) {
                      return;
                    }

                    const uploadedFile = await uploadImage(nextFile);
                    if (uploadedFile?.id) {
                      setFieldValue(`${prefix}.imageFileId`, uploadedFile.id);
                    }

                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent disabled:opacity-40"
                  disabled={isUploadingImage || !imageFileId}
                  onClick={() => setFieldValue(`${prefix}.imageFileId`, null)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrustedCompaniesEditor() {
  const {
    draftContent,
    setFieldValue,
    addTrustedCompany,
    removeTrustedCompany,
  } = useGuestLiveEditor();

  const companies = getByPath(draftContent, HOME_TRUSTED_COMPANIES_PATH);
  const trustedCompanies = Array.isArray(companies) ? companies : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Tambah partner/brand untuk area trusted logo.
        </p>
        <button
          type="button"
          onClick={addTrustedCompany}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          Add Company
        </button>
      </div>

      {trustedCompanies.map((companyItem, index) => (
        <div
          key={`trusted-company-${index}`}
          className="rounded-xl border border-border bg-card p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-foreground">
              Company {index + 1}
            </p>
            <button
              type="button"
              onClick={() => removeTrustedCompany(index)}
              disabled={trustedCompanies.length <= 1}
              className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-border hover:bg-background-accent disabled:opacity-40"
            >
              Remove
            </button>
          </div>

          <TiptapFieldEditor
            label={`Company ${index + 1}`}
            value={companyItem}
            onChange={(nextDoc) =>
              setFieldValue(`${HOME_TRUSTED_COMPANIES_PATH}.${index}`, nextDoc)
            }
          />
        </div>
      ))}
    </div>
  );
}

export default function GuestLiveEditorPanel() {
  const {
    isLiveEditEnabled,
    pageKey,
    draftContent,
    selectedPath,
    isPanelOpen,
    setIsPanelOpen,
    setFieldValue,
    handleSave,
    hasUnsavedChanges,
    isSaving,
  } = useGuestLiveEditor();

  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => {
    if (!isLiveEditEnabled || !selectedPath) {
      return;
    }

    setActiveTab("content");
    setIsPanelOpen(true);
  }, [isLiveEditEnabled, selectedPath, setIsPanelOpen]);

  const sections = useMemo(() => getLiveEditorSections(pageKey), [pageKey]);
  const allFields = useMemo(
    () => sections.flatMap((section) => section.fields),
    [sections],
  );

  const selectedField = useMemo(() => {
    if (!selectedPath) {
      return null;
    }

    const mappedField = allFields.find(
      (fieldItem) => fieldItem.path === selectedPath,
    );

    if (mappedField) {
      return mappedField;
    }

    const inferredLabel = selectedPath
      .split(".")
      .map((segment) =>
        segment
          .replaceAll(/([A-Z])/g, " $1")
          .replaceAll("-", " ")
          .trim(),
      )
      .join(" / ");

    return {
      label: inferredLabel.toUpperCase(),
      path: selectedPath,
    };
  }, [allFields, selectedPath]);

  if (!isLiveEditEnabled) {
    return null;
  }

  return (
    <>
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent
          side="right"
          className="w-[94vw] sm:max-w-[640px] p-0 overflow-hidden flex flex-col"
        >
          <SheetHeader className="p-5 border-b border-border">
            <SheetTitle className="text-base font-black tracking-wide uppercase">
              Live Editor
            </SheetTitle>
            <SheetDescription>
              Klik elemen di halaman untuk fokus ke field terkait, lalu simpan.
            </SheetDescription>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] px-2 py-1 rounded-md border font-semibold uppercase tracking-wider ${
                  hasUnsavedChanges
                    ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900"
                }`}
              >
                {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
              </span>
              <button
                type="button"
                disabled={!hasUnsavedChanges || isSaving}
                onClick={handleSave}
                className="px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </SheetHeader>

          <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                activeTab === "content"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              Content
            </button>
            {pageKey === "home" && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("images")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "images"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Images
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("banners")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "banners"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Banners
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("sections")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "sections"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Sections
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ads")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "ads"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Ads
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("trusted")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "trusted"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Trusted
                </button>
              </>
            )}
            {pageKey === "about" && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("stats")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "stats"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Stats
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("sections")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    activeTab === "sections"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  Sections
                </button>
              </>
            )}
            {pageKey === "contact" && (
              <button
                type="button"
                onClick={() => setActiveTab("contact")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                  activeTab === "contact"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                Info
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === "content" && (
              <>
                {selectedField && (
                  <div className="rounded-xl border border-primary/40 bg-primary-soft/30 p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                      Selected from page
                    </p>
                    <TiptapFieldEditor
                      label={selectedField.label}
                      value={getByPath(draftContent, selectedField.path)}
                      onChange={(nextDoc) =>
                        setFieldValue(selectedField.path, nextDoc)
                      }
                    />
                  </div>
                )}
                {!selectedField && (
                  <div className="rounded-xl border border-dashed border-border bg-card p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Pilih komponen dulu
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Klik teks/komponen di halaman home untuk memunculkan opsi
                      edit field spesifik di sini.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeTab === "images" && pageKey === "home" && (
              <div className="space-y-3">
                {HOME_IMAGE_FIELDS.map((imageField) => (
                  <ImageFieldCard key={imageField.path} {...imageField} />
                ))}
              </div>
            )}

            {activeTab === "banners" && pageKey === "home" && <BannersEditor />}
            {activeTab === "sections" && (
              <CustomSectionsEditor
                path={
                  pageKey === "home"
                    ? HOME_CUSTOM_SECTIONS_PATH
                    : ABOUT_CUSTOM_SECTIONS_PATH
                }
              />
            )}
            {activeTab === "ads" && pageKey === "home" && <AdsEditor />}
            {activeTab === "trusted" && pageKey === "home" && (
              <TrustedCompaniesEditor />
            )}
            {activeTab === "stats" && pageKey === "about" && <StatsEditor />}
            {activeTab === "contact" && pageKey === "contact" && (
              <ContactItemsEditor />
            )}
          </div>
        </SheetContent>
      </Sheet>
      {!isPanelOpen && (
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover"
        >
          Open Editor
        </button>
      )}
    </>
  );
}
