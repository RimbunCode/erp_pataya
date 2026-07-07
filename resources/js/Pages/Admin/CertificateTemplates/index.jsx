import { useState } from "react";
import { useForm, usePage, router } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";

const PLACEHOLDERS = [
  { key: "{{student_name}}", label: "Nama Student" },
  { key: "{{course_title}}", label: "Judul Kursus" },
  { key: "{{issued_date}}", label: "Tanggal Terbit" },
  { key: "{{expiry_date}}", label: "Tanggal Kedaluwarsa" },
  { key: "{{credential_id}}", label: "ID Sertifikat" },
  { key: "{{certificate_type}}", label: "Tipe Sertifikat" },
];

function PlaceholderGuide() {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <h2 className="text-sm font-bold text-[var(--foreground)] mb-1">
        Panduan Placeholder
      </h2>
      <p className="text-xs text-[var(--muted-foreground)] mb-3">
        Gunakan placeholder berikut di template Google Docs Anda.
      </p>
      <div className="flex flex-col gap-1.5">
        {PLACEHOLDERS.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3">
            <code className="text-[10px] font-bold bg-[var(--muted)] text-[var(--foreground)] px-2 py-1 rounded-md">
              {p.key}
            </code>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddTemplateForm({ courses }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    name: "",
    gdoc_template_id: "",
    course_id: "",
    is_active: true,
    front_content: "",
    back_content: "",
    signer_name: "",
    signer_title: "",
  });
  const [templateType, setTemplateType] = useState("gdoc");

  const submit = (e) => {
    e.preventDefault();
    post(route("admin.certificate-templates.store"), {
      preserveScroll: true,
      onSuccess: () => reset(),
    });
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 h-fit">
      <h2 className="text-sm font-bold text-[var(--foreground)]">
        Tambah Template
      </h2>
      <p className="text-xs text-[var(--muted-foreground)] mt-1 mb-4">
        Template bisa memakai Google Docs (proses lama) atau dibuat langsung di aplikasi (internal).
      </p>

      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
            Nama Template
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => setData("name", e.target.value)}
            placeholder="Contoh: Template Sertifikat BIM"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          {errors.name && (
            <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTemplateType("gdoc")}
            className={`flex-1 text-[10px] font-black uppercase py-2 rounded-lg ${templateType === "gdoc" ? "bg-[var(--primary)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
          >
            Google Docs
          </button>
          <button
            type="button"
            onClick={() => setTemplateType("internal")}
            className={`flex-1 text-[10px] font-black uppercase py-2 rounded-lg ${templateType === "internal" ? "bg-[var(--primary)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
          >
            Internal (PDF)
          </button>
        </div>

        {templateType === "gdoc" ? (
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
              Google Docs Document ID
            </label>
            <input
              type="text"
              value={data.gdoc_template_id}
              onChange={(e) => setData("gdoc_template_id", e.target.value)}
              placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OlH..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              Ambil dari URL: docs.google.com/document/d/
              <strong>ID_INI</strong>/edit
            </p>
            {errors.gdoc_template_id && (
              <p className="text-[11px] text-red-600 mt-1">
                {errors.gdoc_template_id}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
                Nama Penandatangan
              </label>
              <input
                type="text"
                value={data.signer_name}
                onChange={(e) => setData("signer_name", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
                Jabatan Penandatangan
              </label>
              <input
                type="text"
                value={data.signer_title}
                onChange={(e) => setData("signer_title", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
            Kursus{" "}
            <span className="font-normal text-[var(--muted-foreground)]">
              (opsional — kosongkan untuk default semua kursus)
            </span>
          </label>
          <select
            value={data.course_id}
            onChange={(e) => setData("course_id", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="">Default (Semua Kursus)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            id="is_active"
            type="checkbox"
            checked={data.is_active}
            onChange={(e) => setData("is_active", e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          <label
            htmlFor="is_active"
            className="text-xs font-semibold text-[var(--foreground)]"
          >
            Aktif
          </label>
        </div>

        <button
          type="submit"
          disabled={processing}
          className="w-full rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
        >
          {processing ? "Menyimpan..." : "Tambah Template"}
        </button>
      </form>
    </div>
  );
}

function TemplateRow({ template }) {
  const handleDelete = () => {
    if (!confirm(`Hapus template "${template.name}"?`)) return;
    router.delete(
      route("admin.certificate-templates.destroy", template.id),
      { preserveScroll: true },
    );
  };

  const toggleActive = () => {
    router.patch(
      route("admin.certificate-templates.update", template.id),
      { ...template, gdoc_template_id: template.gdocTemplateId, is_active: !template.isActive },
      { preserveScroll: true },
    );
  };

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-5 py-3">
        <p className="font-semibold text-[var(--foreground)] text-sm">
          {template.name}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
          {template.courseName}
        </p>
      </td>
      <td className="px-5 py-3">
        {template.isInternal ? (
          <span className="text-[10px] font-bold bg-[var(--muted)] px-2 py-1 rounded text-[var(--foreground)]">
            Internal (PDF)
          </span>
        ) : (
          <code className="text-[10px] bg-[var(--muted)] px-2 py-1 rounded text-[var(--foreground)] break-all">
            {template.gdocTemplateId}
          </code>
        )}
      </td>
      <td className="px-5 py-3 text-center">
        <span className="text-xs font-bold text-[var(--muted-foreground)]">
          {template.totalIssued}
        </span>
      </td>
      <td className="px-5 py-3 text-center">
        <button
          onClick={toggleActive}
          className={`text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-lg transition-colors ${
            template.isActive
              ? "bg-green-50 text-green-600"
              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
          }`}
        >
          {template.isActive ? "Aktif" : "Nonaktif"}
        </button>
      </td>
      <td className="px-5 py-3 text-xs text-[var(--muted-foreground)]">
        {template.createdAt}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          {template.docsEditUrl && (
            <a
              href={template.docsEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-[var(--primary)] hover:underline uppercase tracking-wide"
            >
              Edit Docs
            </a>
          )}
          <button
            onClick={handleDelete}
            className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wide"
          >
            Hapus
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CertificateTemplatesPage() {
  const { templates = [], courses = [] } = usePage().props;

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
            TEMPLATE SERTIFIKAT
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Kelola template Google Docs untuk penerbitan sertifikat otomatis.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-1 flex flex-col gap-5">
            <AddTemplateForm courses={courses} />
            <PlaceholderGuide />
          </div>

          <div className="xl:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                Daftar Template
              </h2>
              <span className="text-xs text-[var(--muted-foreground)]">
                Total: {templates.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--secondary)]">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Template
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Document ID
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Issued
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Dibuat
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-[var(--muted-foreground)] text-xs"
                      >
                        Belum ada template. Tambahkan template pertama Anda.
                      </td>
                    </tr>
                  ) : (
                    templates.map((t) => (
                      <TemplateRow key={t.id} template={t} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
