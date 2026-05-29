import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";
import TiptapFieldEditor from "./components/TiptapFieldEditor";
import { docToPlainText, ensureTiptapDoc } from "@/lib/tiptapContent";

const PAGE_CONFIG = [
  {
    key: "home",
    label: "Home",
    sections: [
      {
        title: "Hero",
        fields: [
          { label: "Badge", path: "home.hero.badge" },
          { label: "Title", path: "home.hero.title" },
          { label: "Description", path: "home.hero.description" },
          { label: "Primary CTA", path: "home.hero.primaryCtaLabel" },
          { label: "Secondary CTA", path: "home.hero.secondaryCtaLabel" },
          { label: "Stats Label", path: "home.hero.statsLabel" },
          { label: "Top Card Title", path: "home.hero.topCardTitle" },
          { label: "Top Card Subtitle", path: "home.hero.topCardSubtitle" },
          {
            label: "Bottom Card Title",
            path: "home.hero.bottomCardTitle",
          },
          {
            label: "Bottom Card Subtitle",
            path: "home.hero.bottomCardSubtitle",
          },
        ],
      },
      {
        title: "Trusted",
        fields: [
          { label: "Heading", path: "home.trusted.heading" },
          { label: "Company 1", path: "home.trusted.companies.0" },
          { label: "Company 2", path: "home.trusted.companies.1" },
          { label: "Company 3", path: "home.trusted.companies.2" },
          { label: "Company 4", path: "home.trusted.companies.3" },
          { label: "Company 5", path: "home.trusted.companies.4" },
        ],
      },
      {
        title: "Popular Training Intro",
        fields: [
          { label: "Heading", path: "home.popular.heading" },
          { label: "Description", path: "home.popular.description" },
        ],
      },
      {
        title: "Why Inkindo",
        fields: [
          { label: "Heading", path: "home.why.heading" },
          { label: "Description", path: "home.why.description" },
          { label: "Feature 1 Title", path: "home.why.features.0.title" },
          {
            label: "Feature 1 Description",
            path: "home.why.features.0.description",
          },
          {
            label: "Feature 1 Link Label",
            path: "home.why.features.0.linkLabel",
          },
          { label: "Feature 2 Title", path: "home.why.features.1.title" },
          {
            label: "Feature 2 Description",
            path: "home.why.features.1.description",
          },
          {
            label: "Feature 2 Link Label",
            path: "home.why.features.1.linkLabel",
          },
          { label: "Feature 3 Title", path: "home.why.features.2.title" },
          {
            label: "Feature 3 Description",
            path: "home.why.features.2.description",
          },
          {
            label: "Feature 3 Link Label",
            path: "home.why.features.2.linkLabel",
          },
        ],
      },
      {
        title: "Bottom CTA Banner",
        fields: [
          { label: "Heading", path: "home.ctaBanner.heading" },
          { label: "Description", path: "home.ctaBanner.description" },
          { label: "Primary CTA", path: "home.ctaBanner.primaryCta" },
          { label: "Secondary CTA", path: "home.ctaBanner.secondaryCta" },
        ],
      },
    ],
  },
  {
    key: "about",
    label: "About",
    sections: [
      {
        title: "Hero",
        fields: [
          { label: "Title", path: "about.hero.title" },
          { label: "Description", path: "about.hero.description" },
        ],
      },
      {
        title: "Stats",
        fields: [
          { label: "Stat 1 Value", path: "about.stats.0.value" },
          { label: "Stat 1 Label", path: "about.stats.0.label" },
          { label: "Stat 2 Value", path: "about.stats.1.value" },
          { label: "Stat 2 Label", path: "about.stats.1.label" },
          { label: "Stat 3 Value", path: "about.stats.2.value" },
          { label: "Stat 3 Label", path: "about.stats.2.label" },
          { label: "Stat 4 Value", path: "about.stats.3.value" },
          { label: "Stat 4 Label", path: "about.stats.3.label" },
        ],
      },
      {
        title: "Vision",
        fields: [
          { label: "Title", path: "about.vision.title" },
          { label: "Description", path: "about.vision.description" },
        ],
      },
      {
        title: "Mission",
        fields: [
          { label: "Title", path: "about.mission.title" },
          { label: "Mission Item 1", path: "about.mission.items.0" },
          { label: "Mission Item 2", path: "about.mission.items.1" },
          { label: "Mission Item 3", path: "about.mission.items.2" },
          { label: "Mission Item 4", path: "about.mission.items.3" },
          { label: "Mission Item 5", path: "about.mission.items.4" },
          { label: "Mission Item 6", path: "about.mission.items.5" },
          { label: "Mission Item 7", path: "about.mission.items.6" },
          { label: "Mission Item 8", path: "about.mission.items.7" },
        ],
      },
    ],
  },
  {
    key: "verify",
    label: "Verify",
    sections: [
      {
        title: "Main Content",
        fields: [
          { label: "Title", path: "verify.title" },
          { label: "Description", path: "verify.description" },
          { label: "Field Label", path: "verify.fieldLabel" },
          { label: "Input Placeholder", path: "verify.placeholder" },
          { label: "Button Label", path: "verify.buttonLabel" },
          { label: "Security Tip", path: "verify.securityTip" },
        ],
      },
    ],
  },
  {
    key: "contact",
    label: "Contact",
    sections: [
      {
        title: "Hero",
        fields: [
          { label: "Title", path: "contact.hero.title" },
          { label: "Description", path: "contact.hero.description" },
        ],
      },
      {
        title: "Contact Information",
        fields: [
          { label: "Address Label", path: "contact.contactItems.0.label" },
          { label: "Address Value", path: "contact.contactItems.0.value" },
          { label: "Phone Label", path: "contact.contactItems.1.label" },
          { label: "Phone Value", path: "contact.contactItems.1.value" },
          { label: "Email Label", path: "contact.contactItems.2.label" },
          { label: "Email Value", path: "contact.contactItems.2.value" },
          { label: "Support Label", path: "contact.support.label" },
          {
            label: "Support Description",
            path: "contact.support.description",
          },
        ],
      },
      {
        title: "Contact Form",
        fields: [
          {
            label: "Full Name Label",
            path: "contact.form.fullNameLabel",
          },
          {
            label: "Full Name Placeholder",
            path: "contact.form.fullNamePlaceholder",
          },
          { label: "Email Label", path: "contact.form.emailLabel" },
          {
            label: "Email Placeholder",
            path: "contact.form.emailPlaceholder",
          },
          { label: "Subject Label", path: "contact.form.subjectLabel" },
          {
            label: "Subject Placeholder",
            path: "contact.form.subjectPlaceholder",
          },
          { label: "Message Label", path: "contact.form.messageLabel" },
          {
            label: "Message Placeholder",
            path: "contact.form.messagePlaceholder",
          },
          { label: "Submit Label", path: "contact.form.submitLabel" },
        ],
      },
    ],
  },
  {
    key: "footer",
    label: "Footer",
    sections: [
      {
        title: "Brand",
        fields: [
          { label: "Brand Title", path: "footer.brand.title" },
          { label: "Brand Subtitle", path: "footer.brand.subtitle" },
          { label: "Brand Description", path: "footer.brand.description" },
        ],
      },
      {
        title: "Explore Links",
        fields: [
          { label: "Section Title", path: "footer.explore.title" },
          { label: "Link 1", path: "footer.explore.links.0" },
          { label: "Link 2", path: "footer.explore.links.1" },
          { label: "Link 3", path: "footer.explore.links.2" },
          { label: "Link 4", path: "footer.explore.links.3" },
        ],
      },
      {
        title: "Company Links",
        fields: [
          { label: "Section Title", path: "footer.company.title" },
          { label: "Link 1", path: "footer.company.links.0" },
          { label: "Link 2", path: "footer.company.links.1" },
          { label: "Link 3", path: "footer.company.links.2" },
          { label: "Link 4", path: "footer.company.links.3" },
        ],
      },
      {
        title: "Contact",
        fields: [
          { label: "Section Title", path: "footer.contact.title" },
          { label: "Address", path: "footer.contact.address" },
          { label: "Phone", path: "footer.contact.phone" },
          { label: "Email", path: "footer.contact.email" },
        ],
      },
      {
        title: "Bottom Bar",
        fields: [
          { label: "Copyright", path: "footer.bottom.copyright" },
          { label: "Help Center Label", path: "footer.bottom.helpCenter" },
          { label: "Sitemap Label", path: "footer.bottom.sitemap" },
        ],
      },
    ],
  },
];

function parsePath(path) {
  return path
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function getByPath(obj, path) {
  const segments = parsePath(path);

  return segments.reduce((currentValue, segment) => {
    if (currentValue == null) {
      return undefined;
    }

    return currentValue[segment];
  }, obj);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        cloneValue(entryValue),
      ]),
    );
  }

  return value;
}

function setByPath(obj, path, nextValue) {
  const segments = parsePath(path);
  const next = cloneValue(obj);

  let cursor = next;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];

    if (cursor[segment] == null) {
      cursor[segment] = typeof nextSegment === "number" ? [] : {};
    }

    cursor = cursor[segment];
  }

  cursor[segments[segments.length - 1]] = nextValue;

  return next;
}

export default function LandingPageSettings() {
  const { content: initialContent = {}, flash = {} } = usePage().props;

  const [activePageKey, setActivePageKey] = useState("home");
  const [draftContent, setDraftContent] = useState(() =>
    cloneValue(initialContent),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftContent(cloneValue(initialContent));
  }, [initialContent]);

  const currentPage = useMemo(
    () =>
      PAGE_CONFIG.find((item) => item.key === activePageKey) ?? PAGE_CONFIG[0],
    [activePageKey],
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draftContent) !== JSON.stringify(initialContent),
    [draftContent, initialContent],
  );

  const setFieldValue = (path, value) => {
    setDraftContent((previousValue) => setByPath(previousValue, path, value));
  };

  const handleSave = () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    router.patch(
      route("admin.landing-page-settings.update"),
      {
        content: draftContent,
      },
      {
        preserveScroll: true,
        onFinish: () => {
          setIsSaving(false);
        },
      },
    );
  };

  const previewItems = useMemo(() => {
    const flattenedFields = currentPage.sections.flatMap(
      (section) => section.fields,
    );

    return flattenedFields.map((field) => {
      const fieldValue = ensureTiptapDoc(getByPath(draftContent, field.path));

      return {
        key: field.path,
        label: field.label,
        value: docToPlainText(fieldValue),
      };
    });
  }, [currentPage, draftContent]);

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
              LANDING PAGE SETTINGS
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Kelola semua konten halaman Guest menggunakan editor TipTap.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                hasUnsavedChanges
                  ? "text-amber-700 bg-amber-100 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
                  : "text-emerald-700 bg-emerald-100 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
              }`}
            >
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save & Publish"}
            </button>
          </div>
        </div>

        {flash?.success && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs px-3 py-2">
            {flash.success}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
          {PAGE_CONFIG.map((page) => (
            <button
              key={page.key}
              type="button"
              onClick={() => setActivePageKey(page.key)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-colors ${
                activePageKey === page.key
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--background-accent)]"
              }`}
            >
              {page.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div className="space-y-5">
            {currentPage.sections.map((section) => (
              <section
                key={section.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4"
              >
                <h2 className="text-sm font-black uppercase tracking-wide text-[var(--foreground)]">
                  {section.title}
                </h2>

                <div className="space-y-4">
                  {section.fields.map((field) => (
                    <TiptapFieldEditor
                      key={field.path}
                      label={field.label}
                      value={getByPath(draftContent, field.path)}
                      onChange={(nextDoc) => setFieldValue(field.path, nextDoc)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="xl:sticky xl:top-20 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <h2 className="text-sm font-black uppercase tracking-wide text-[var(--foreground)]">
              Live Preview Summary
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Snapshot teks untuk halaman <strong>{currentPage.label}</strong>.
            </p>

            <div className="space-y-2">
              {previewItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="text-xs text-[var(--foreground)] mt-1 whitespace-pre-line leading-relaxed">
                    {item.value || "-"}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
