import { useState, useRef } from "react";
import { router, useForm } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatRp(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const statusConfig = {
  published: {
    label: "Published",
    color: "text-green-600",
    bg: "bg-green-50",
    dot: "bg-green-500",
  },
  draft: {
    label: "Draft",
    color: "text-gray-400",
    bg: "bg-gray-100",
    dot: "bg-gray-300",
  },
};

const levelColor = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

const contentTypeCfg = {
  pre_assessment: {
    label: "Pre Assessment",
    icon: "amber",
    bg: "bg-amber-50 border-amber-100",
  },
  material: {
    label: "Material",
    icon: "blue",
    bg: "bg-blue-50 border-blue-100",
  },
  assignment: {
    label: "Assignment",
    icon: "violet",
    bg: "bg-violet-50 border-violet-100",
  },
};

const inputClass =
  "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";
const labelClass =
  "block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-1.5";

// ── Icon per type ──────────────────────────────────────────────────────────────
function TypeIcon({ type }) {
  if (type === "pre_assessment")
    return (
      <svg
        className="w-3.5 h-3.5 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    );
  if (type === "assignment")
    return (
      <svg
        className="w-3.5 h-3.5 text-violet-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    );
  return (
    <svg
      className="w-3.5 h-3.5 text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// ── Edit Course Info Modal ─────────────────────────────────────────────────────
function EditCourseModal({ course, categories, onClose }) {
  const { data, setData, put, processing, errors } = useForm({
    title: course.title,
    description: course.description,
    price: course.price,
    level: course.level,
    category: course.categories?.[0] ?? "",
    total_hours: course.total_hours,
    total_sessions: course.total_sessions,
    certificate_type: course.certificate_type ?? "",
  });

  const submit = () =>
    put(route("instructor.classes.update", course.id), { onSuccess: onClose });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500 flex-shrink-0" />
        <div className="px-8 pt-7 pb-4 flex-shrink-0 flex items-center justify-between border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-800 uppercase tracking-tight">
              Edit Course Info
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Update course details and settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-4">
          <div>
            <label className={labelClass}>Course Title</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData("title", e.target.value)}
              className={inputClass}
            />
            {errors.title && (
              <p className="text-[10px] text-red-500 mt-1">{errors.title}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={data.description}
              onChange={(e) => setData("description", e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={data.category}
                onChange={(e) => setData("category", e.target.value)}
                className={inputClass}
              >
                <option value="">Select...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Level</label>
              <select
                value={data.level}
                onChange={(e) => setData("level", e.target.value)}
                className={inputClass}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Price (IDR)</label>
              <input
                type="number"
                value={data.price}
                onChange={(e) => setData("price", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Certificate Type</label>
              <select
                value={data.certificate_type}
                onChange={(e) => setData("certificate_type", e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                <option value="professional">Professional</option>
                <option value="competency">Competency</option>
                <option value="attendance">Attendance</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Total Hours</label>
              <input
                type="number"
                value={data.total_hours}
                onChange={(e) => setData("total_hours", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Total Sessions</label>
              <input
                type="number"
                value={data.total_sessions}
                onChange={(e) => setData("total_sessions", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={processing}
            className="flex-1 py-3 text-xs font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-60"
          >
            {processing ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Note Modal ─────────────────────────────────────────────────────────────
function AddNoteModal({ courseId, onClose }) {
  const { data, setData, post, processing } = useForm({ content: "" });
  const submit = () =>
    post(route("instructor.classes.notes.store", courseId), {
      onSuccess: onClose,
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500 flex-shrink-0" />
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">
            Add Note
          </h3>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-7 py-5 space-y-4">
          <div>
            <label className={labelClass}>Note Content</label>
            <textarea
              value={data.content}
              onChange={(e) => setData("content", e.target.value)}
              rows={5}
              placeholder="Write your note or announcement for students..."
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={processing || !data.content.trim()}
              className="flex-1 py-2.5 text-xs font-black tracking-widest uppercase bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-md disabled:opacity-50"
            >
              {processing ? "Saving..." : "Post Note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Upload / Link Modal (for content file) ────────────────────────────────────
function ContentFileModal({ content, courseId, sectionId, onClose }) {
  const [mode, setMode] = useState("upload"); // upload | link
  const fileRef = useRef();
  const { data, setData, post, processing } = useForm({
    file: null,
    url: "",
    description: "",
  });

  const submit = () => {
    const formData = new FormData();
    formData.append("description", data.description);
    if (mode === "upload" && data.file) formData.append("file", data.file);
    if (mode === "link" && data.url) formData.append("url", data.url);

    router.post(
      route("instructor.classes.sections.contents.upload", {
        course: courseId,
        section: sectionId,
        content: content.id,
      }),
      formData,
      { onSuccess: onClose, forceFormData: true },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500 flex-shrink-0" />
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">
              Upload — {content.title}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
              {contentTypeCfg[content.type]?.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-7 py-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {["upload", "link"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all capitalize
                  ${mode === m ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                {m === "upload" ? "📁 Upload File" : "🔗 Paste Link"}
              </button>
            ))}
          </div>

          {mode === "upload" ? (
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all
                ${data.file ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.mp4,.zip"
                onChange={(e) => setData("file", e.target.files[0])}
              />
              {data.file ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-black text-blue-700 text-center">
                    {data.file.name}
                  </p>
                  <p className="text-[9px] text-blue-400">
                    Klik untuk ganti file
                  </p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-black text-gray-500">
                    Klik untuk upload file
                  </p>
                  <p className="text-[9px] text-gray-300">
                    PDF, Word, Excel, PPT, MP4, ZIP • Maks. 50MB
                  </p>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className={labelClass}>URL / Link</label>
              <input
                type="url"
                value={data.url}
                onChange={(e) => setData("url", e.target.value)}
                placeholder="https://drive.google.com/... atau https://youtube.com/..."
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>
              Deskripsi / Instruksi (opsional)
            </label>
            <textarea
              value={data.description}
              onChange={(e) => setData("description", e.target.value)}
              rows={2}
              placeholder="Tambahkan instruksi untuk konten ini..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-all"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={
                processing || (mode === "upload" ? !data.file : !data.url)
              }
              className="flex-1 py-2.5 text-xs font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50"
            >
              {processing ? "Uploading..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Content Item (inline edit) ─────────────────────────────────────────────────
function ContentItem({ content, courseId, sectionId, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState(content.title);
  const cfg = contentTypeCfg[content.type] ?? contentTypeCfg.material;

  const saveTitle = () => {
    router.patch(
      route("instructor.classes.sections.contents.update", {
        course: courseId,
        section: sectionId,
        content: content.id,
      }),
      { title },
      { onSuccess: () => setEditing(false), preserveScroll: true },
    );
  };

  return (
    <>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} group`}
      >
        <TypeIcon type={content.type} />

        {/* Title — inline edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div>
              <p className="text-xs font-bold text-gray-700 truncate">
                {content.title}
              </p>
              {content.description && (
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                  {content.description}
                </p>
              )}
              {content.file_url && (
                <a
                  href={content.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 mt-1 hover:text-blue-700"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {content.file_name ?? "View File"}
                </a>
              )}
              {content.url && (
                <a
                  href={content.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 mt-1 hover:text-blue-700"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  External Link
                </a>
              )}
            </div>
          )}
        </div>

        <span className="text-[9px] font-black tracking-widest uppercase text-gray-400 flex-shrink-0">
          {cfg.label}
        </span>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* Upload/link button */}
          <button
            onClick={() => setShowUpload(true)}
            title="Upload file atau paste link"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </button>
          {/* Edit title */}
          {editing ? (
            <>
              <button
                onClick={saveTitle}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setTitle(content.title);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {/* Delete */}
          <button
            onClick={() => onDelete(content.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {showUpload && (
        <ContentFileModal
          content={content}
          courseId={courseId}
          sectionId={sectionId}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}

// ── Section (inline edit) ──────────────────────────────────────────────────────
function SectionBlock({ section, index, courseId, onDelete }) {
  const [open, setOpen] = useState(index === 0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [addingType, setAddingType] = useState(null); // "pre_assessment"|"material"|"assignment"|null
  const [newTitle, setNewTitle] = useState("");

  const saveTitle = () => {
    router.patch(
      route("instructor.classes.sections.update", {
        course: courseId,
        section: section.id,
      }),
      { title },
      { onSuccess: () => setEditingTitle(false), preserveScroll: true },
    );
  };

  const addContent = () => {
    if (!newTitle.trim()) return;
    router.post(
      route("instructor.classes.sections.contents.store", {
        course: courseId,
        section: section.id,
      }),
      { title: newTitle, type: addingType },
      {
        onSuccess: () => {
          setAddingType(null);
          setNewTitle("");
        },
        preserveScroll: true,
      },
    );
  };

  const deleteContent = (contentId) => {
    if (!confirm("Delete this content?")) return;
    router.delete(
      route("instructor.classes.sections.contents.destroy", {
        course: courseId,
        section: section.id,
        content: contentId,
      }),
      { preserveScroll: true },
    );
  };

  return (
    <div className="border-2 border-gray-100 rounded-2xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-gray-50 border-b border-gray-100">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-black text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          {editingTitle ? (
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitle(section.title);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <span className="flex-1 text-sm font-black text-gray-800 uppercase tracking-wide truncate">
              {section.title}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Section actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editingTitle ? (
            <>
              <button
                onClick={saveTitle}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  setEditingTitle(false);
                  setTitle(section.title);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-300 hover:text-blue-500 hover:border-blue-300 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDelete(section.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Contents */}
      {open && (
        <div className="p-4 space-y-2">
          {section.contents?.map((content) => (
            <ContentItem
              key={content.id}
              content={content}
              courseId={courseId}
              sectionId={section.id}
              onDelete={deleteContent}
            />
          ))}

          {/* Add content inline */}
          {addingType ? (
            <div className="flex items-center gap-2 mt-2">
              <div
                className={`flex items-center gap-2 flex-1 p-2.5 rounded-xl border ${contentTypeCfg[addingType]?.bg}`}
              >
                <TypeIcon type={addingType} />
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addContent();
                    if (e.key === "Escape") {
                      setAddingType(null);
                      setNewTitle("");
                    }
                  }}
                  placeholder="Content title... (Enter to save)"
                  className="flex-1 bg-transparent text-xs font-bold text-gray-700 placeholder-gray-300 focus:outline-none"
                />
              </div>
              <button
                onClick={addContent}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  setAddingType(null);
                  setNewTitle("");
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
                Add:
              </span>
              {Object.entries(contentTypeCfg).map(([type, cfg]) => (
                <button
                  key={type}
                  onClick={() => setAddingType(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest uppercase rounded-xl border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                >
                  <TypeIcon type={type} />
                  {cfg.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }) {
  const accents = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accents[accent]}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mt-0.5">
        {label}
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CourseDetail({ course, categories = [] }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const cfg = statusConfig[course.status] ?? statusConfig.draft;
  const levelCls =
    levelColor[course.level?.toLowerCase()] ?? "bg-gray-100 text-gray-500";

  const addSection = () => {
    router.post(
      route("instructor.classes.sections.store", course.id),
      { title: "New Section" },
      { preserveScroll: true },
    );
  };

  const deleteSection = (sectionId) => {
    if (!confirm("Delete this section and all its contents?")) return;
    router.delete(
      route("instructor.classes.sections.destroy", {
        course: course.id,
        section: sectionId,
      }),
      { preserveScroll: true },
    );
  };

  const totalContents =
    course.sections?.reduce((sum, s) => sum + (s.contents?.length ?? 0), 0) ??
    0;

  return (
    <MainLayout title="Course Detail" breadcrumb={course.title}>
      <div className="p-8 space-y-6">
        {/* Back */}
        <button
          onClick={() => router.visit(route("instructor.classes.index"))}
          className="flex items-center gap-2 text-xs font-bold tracking-widest text-gray-400 uppercase hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Courses
        </button>

        {/* ── Hero ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
          <div className="p-8 flex items-start gap-8">
            {/* Thumbnail */}
            <div className="w-48 h-36 rounded-2xl overflow-hidden flex-shrink-0">
              {course.image ? (
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-white/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={`flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                <span
                  className={`text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg capitalize ${levelCls}`}
                >
                  {course.level}
                </span>
                {course.categories?.map((cat) => (
                  <span
                    key={cat}
                    className="text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500"
                  >
                    {cat}
                  </span>
                ))}
              </div>
              <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-tight mb-2">
                {course.title}
              </h1>
              <p className="text-xs text-gray-500 leading-relaxed mb-4 max-w-xl">
                {course.description}
              </p>
              <div className="flex items-center gap-6 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {course.total_hours}h • {course.total_sessions} Sessions
                </span>
                {course.certificate_type && (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {course.certificate_type}
                  </span>
                )}
                <span className="font-black text-blue-600">
                  {formatRp(course.price)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Info
              </button>
              <button
                onClick={() => setShowNoteModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-amber-200 text-amber-600 rounded-xl hover:bg-amber-50 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Add Note
              </button>
              <button
                onClick={() =>
                  router.patch(
                    route("instructor.classes.togglePublish", course.id),
                  )
                }
                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-xl transition-all border-2
                  ${course.status === "published" ? "border-gray-200 text-gray-500 hover:bg-gray-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
              >
                {course.status === "published" ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={course.students_count ?? 0}
            accent="blue"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Sections"
            value={course.sections?.length ?? 0}
            accent="violet"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            }
          />
          <StatCard
            label="Total Content"
            value={totalContents}
            accent="amber"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
          <StatCard
            label="Revenue"
            value={formatRp((course.students_count ?? 0) * course.price)}
            accent="green"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>

        {/* ── Notes ── */}
        {course.notes?.length > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
            <h3 className="text-[10px] font-black tracking-widest text-amber-600 uppercase mb-3">
              Course Notes
            </h3>
            <div className="space-y-2">
              {course.notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white rounded-xl border border-amber-100 px-4 py-3 flex items-start justify-between gap-3"
                >
                  <p className="text-xs text-gray-600 leading-relaxed flex-1">
                    {note.content}
                  </p>
                  <span className="text-[9px] text-gray-300 font-medium flex-shrink-0">
                    {note.created_at}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Sections & Content ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-black tracking-widest text-gray-900 uppercase">
              Sections & Content
            </h3>
            <button
              onClick={addSection}
              className="flex items-center gap-2 px-4 py-2 text-[9px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Section
            </button>
          </div>

          <div className="space-y-3">
            {course.sections?.length > 0 ? (
              course.sections.map((section, i) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  index={i}
                  courseId={course.id}
                  onDelete={deleteSection}
                />
              ))
            ) : (
              <div className="py-12 flex flex-col items-center gap-3">
                <svg
                  className="w-10 h-10 text-gray-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                  No sections yet — add one above
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditCourseModal
          course={course}
          categories={categories}
          onClose={() => setShowEditModal(false)}
        />
      )}
      {showNoteModal && (
        <AddNoteModal
          courseId={course.id}
          onClose={() => setShowNoteModal(false)}
        />
      )}
    </MainLayout>
  );
}
