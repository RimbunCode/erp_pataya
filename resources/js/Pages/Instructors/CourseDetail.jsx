import { useState, useRef, useCallback } from "react";
import { router, useForm } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Button } from "@/Components/ui/button";
import { FileTextIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";
import UploadDialog2 from "../Core/Components/UploadDialog2";

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

const contentTypes = {
  pre_assessment: {
    label: "Pre Assessment",
    bg: "bg-amber-50 border-amber-100",
    text: "text-amber-600",
    btn: "bg-amber-500 hover:bg-amber-600",
    tab: "bg-amber-50 text-amber-700 border-amber-200",
  },
  material: {
    label: "Materi",
    bg: "bg-blue-50 border-blue-100",
    text: "text-blue-600",
    btn: "bg-blue-500 hover:bg-blue-600",
    tab: "bg-blue-50 text-blue-700 border-blue-200",
  },
  assignment: {
    label: "Tugas",
    bg: "bg-violet-50 border-violet-100",
    text: "text-violet-600",
    btn: "bg-violet-500 hover:bg-violet-600",
    tab: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const inputClass =
  "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";
const labelClass =
  "block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-1.5";

// ── TypeIcon ───────────────────────────────────────────────────────────────────
function TypeIcon({ type, className = "w-3.5 h-3.5" }) {
  if (type === "pre_assessment")
    return (
      <svg
        className={`${className} text-amber-500`}
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
        className={`${className} text-violet-500`}
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
      className={`${className} text-blue-500`}
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

// ── Edit Course Modal ──────────────────────────────────────────────────────────
function EditCourseModal({ course, categories, onClose }) {
  const thumbnailRef = useRef();
  const [thumbnailPreview, setThumbnailPreview] = useState(
    course.thumbnail ?? null,
  );
  const [thumbnailFile, setThumbnailFile] = useState(null); // File object baru

  const { data, setData, processing, errors } = useForm({
    title: course.title,
    description: course.description,
    price: course.price,
    level: course.level,
    category: course.categories?.[0] ?? "",
    total_hours: course.total_hours,
    total_sessions: course.total_sessions,
    certificate_type: course.certificate_type ?? "",
  });

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (thumbnailRef.current) thumbnailRef.current.value = "";
  };

  const submit = () => {
    const fd = new FormData();
    fd.append("_method", "PUT");
    fd.append("title", data.title);
    fd.append("description", data.description);
    fd.append("price", data.price);
    fd.append("level", data.level);
    fd.append("category", data.category);
    fd.append("total_hours", data.total_hours ?? "");
    fd.append("total_sessions", data.total_sessions ?? "");
    fd.append("certificate_type", data.certificate_type ?? "");

    if (thumbnailFile instanceof File) {
      fd.append("thumbnail", thumbnailFile);
    }
    router.post(route("instructor.classes.update", course.id), fd, {
      onSuccess: onClose,
      preserveScroll: true,
    });
  };

  const isCurrentImage = thumbnailPreview === course.image;

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

        {/* Header */}
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-4">
          {/* ── Thumbnail ── */}
          <div>
            <label className={labelClass}>Thumbnail Course</label>
            <input
              ref={thumbnailRef}
              type="file"
              accept="image/jpg,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnailChange}
            />
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-32 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-gray-100 bg-gray-50 relative">
                {thumbnailPreview ? (
                  <>
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                    {/* Badge: current vs new */}
                    <div className="absolute bottom-1.5 left-1.5">
                      <span
                        className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isCurrentImage ? "bg-gray-800/60 text-white/80" : "bg-blue-600 text-white"}`}
                      >
                        {isCurrentImage ? "Current" : "New"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <svg
                      className="w-6 h-6 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">
                      Default
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => thumbnailRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold tracking-widest uppercase bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all"
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  {thumbnailPreview ? "Ganti Gambar" : "Upload Gambar"}
                </button>
                {thumbnailPreview && (
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold tracking-widest uppercase text-red-400 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Hapus Thumbnail
                  </button>
                )}
                <p className="text-[9px] text-gray-300 font-medium">
                  JPG, PNG, WEBP • Maks. 2MB
                  {!thumbnailFile &&
                    !thumbnailPreview &&
                    " • Logo default akan digunakan"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Fields ── */}
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

        {/* Footer */}
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

// ── Upload / Link Modal ────────────────────────────────────────────────────────
function ContentFileModal({ content, courseId, sectionId, onClose }) {
  const [mode, setMode] = useState("upload");
  const fileRef = useRef();
  const { data, setData, processing } = useForm({
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
      route("instructor.classes.sections.contents.upload", content.id),
      formData,
      { onSuccess: onClose, forceFormData: true },
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">
              Upload — {content.title}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
              {contentTypes[content.type]?.label}
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
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {["upload", "link"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all ${mode === m ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                {m === "upload" ? "📁 Upload File" : "🔗 Paste Link"}
              </button>
            ))}
          </div>
          {mode === "upload" ? (
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all ${data.file ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
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
                  <p className="text-xs font-black text-blue-700">
                    {data.file.name}
                  </p>
                  <p className="text-[9px] text-blue-400">Klik untuk ganti</p>
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
                placeholder="https://drive.google.com/..."
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
              placeholder="Tambahkan instruksi..."
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

// ── Single Content Row ─────────────────────────────────────────────────────────
function ContentRow({ content, courseId, sectionId, onDelete, typeCfg }) {
  const [editing, setEditing] = useState(false);
  const uploadDialogRef = useRef();
  const [title, setTitle] = useState(content.title);

  const saveTitle = () => {
    router.patch(
      route("instructor.classes.sections.contents.update", content.id),
      { title },
      { onSuccess: () => setEditing(false), preserveScroll: true },
    );
  };
  const removeFile = useCallback(
    (id) => {
      console.log(id);
      router.delete(
        route("instructor.classes.sections.contents.files.destroy", {
          content: content.id,
          file: id,
        }),
        {
          preserveScroll: true,
          replace: true,
        },
      );
    },
    [content?.id],
  );

  return (
    <>
      <div
        className={`flex flex-col  px-3 py-2.5 rounded-xl border ${typeCfg.bg} group`}
      >
        <div className="flex items-center gap-3">
          <TypeIcon type={content.type} />
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setTitle(content.title);
                  }
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
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => uploadDialogRef.current?.open()}
              title="Upload / Link"
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
        <ul
          className={cn(
            "mt-2 ml-2 w-[calc(100%-calc(var(--spacing,0.25rem)*2))] flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5",
          )}
        >
          {content?.files &&
            content?.files.map(({ id, name }) => (
              <li key={id}>
                <div
                  className={cn(
                    "w-full flex h-6 min-w-0 -translate-x-px items-center gap-2  rounded-md px-2 text-sidebar-foreground outline-none  [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                    "text-base",
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center flex-1 overflow-hidden gap-x-2">
                        <Link href={route("files.preview", id)}>
                          <FileTextIcon className="size-5" />{" "}
                        </Link>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={route("files.preview", id)}
                          className="hover:underline truncate"
                        >
                          <p className="text-sm truncate">{name}</p>
                        </a>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="start">{name}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full p-0!"
                    onClick={() => {
                      removeFile(id);
                    }}
                  >
                    <XIcon />
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      </div>
      <UploadDialog2
        ref={uploadDialogRef}
        options={{
          route: route(
            "instructor.classes.sections.contents.upload",
            content.id,
          ),
        }}
      />
    </>
  );
}

// ── Content Bucket ─────────────────────────────────────────────────────────────
function ContentBucket({ type, contents, courseId, sectionId, onDelete }) {
  const cfg = contentTypes[type];
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const addContent = () => {
    if (!title.trim()) return;
    router.post(
      route("instructor.classes.sections.contents.store", sectionId),
      { title, type },
      {
        onSuccess: () => {
          setAdding(false);
          setTitle("");
        },
        preserveScroll: true,
      },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeIcon type={type} />
          <span
            className={`text-[10px] font-black tracking-widest uppercase ${cfg.text}`}
          >
            {cfg.label}
          </span>
          <span className="text-[9px] text-gray-300 font-bold">
            ({contents.length})
          </span>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-black tracking-widest uppercase rounded-lg border ${cfg.tab} transition-all`}
          >
            <svg
              className="w-2.5 h-2.5"
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
            Tambah
          </button>
        )}
      </div>
      {contents.map((content) => (
        <ContentRow
          key={content.id}
          content={content}
          courseId={courseId}
          sectionId={sectionId}
          onDelete={onDelete}
          typeCfg={cfg}
        />
      ))}
      {contents.length === 0 && !adding && (
        <div
          className={`px-3 py-2.5 rounded-xl border border-dashed ${cfg.bg} flex items-center gap-2`}
        >
          <TypeIcon type={type} />
          <p className={`text-[10px] font-bold ${cfg.text} opacity-50`}>
            Belum ada {cfg.label.toLowerCase()}
          </p>
        </div>
      )}
      {adding && (
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl border ${cfg.bg}`}
          >
            <TypeIcon type={type} />
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addContent();
                if (e.key === "Escape") {
                  setAdding(false);
                  setTitle("");
                }
              }}
              placeholder={`Judul ${cfg.label.toLowerCase()}... (Enter untuk simpan)`}
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
              setAdding(false);
              setTitle("");
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
      )}
    </div>
  );
}

// ── Section Notes ──────────────────────────────────────────────────────────────
function SectionNotes({ notes = [], courseId, sectionId }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data, setData, post, processing, reset } = useForm({ content: "" });

  const submit = () => {
    post(route("instructor.classes.sections.notes.store", sectionId), {
      onSuccess: () => {
        reset();
        setAdding(false);
      },
      preserveScroll: true,
    });
  };

  const deleteNote = (noteId) => {
    router.delete(route("instructor.classes.sections.notes.destroy", noteId), {
      preserveScroll: true,
    });
  };

  return (
    <div className="border-t border-gray-100 mt-3 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-amber-500 hover:text-amber-600 transition-colors"
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
        Notes ({notes.length})
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
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
      {open && (
        <div className="mt-3 space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 group"
            >
              <p className="text-xs text-gray-600 leading-relaxed flex-1">
                {note.message}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[9px] text-gray-300 font-medium">
                  {note.created_at}
                </span>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {notes.length === 0 && !adding && (
            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest px-1">
              Belum ada note
            </p>
          )}
          {adding ? (
            <div className="space-y-2">
              <textarea
                value={data.content}
                onChange={(e) => setData("content", e.target.value)}
                rows={3}
                placeholder="Tulis note..."
                className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAdding(false);
                    reset();
                  }}
                  className="flex-1 py-2 text-[10px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={processing || !data.content.trim()}
                  className="flex-1 py-2 text-[10px] font-black tracking-widest uppercase bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
                >
                  {processing ? "..." : "Post Note"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-amber-500 hover:text-amber-600 transition-colors px-1"
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
              Add Note
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section Block ──────────────────────────────────────────────────────────────
function SectionBlock({ section, index, courseId, onDelete }) {
  const [open, setOpen] = useState(index === 0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);

  const saveTitle = () => {
    router.patch(
      route("instructor.classes.sections.update", section.id),
      { title },
      { onSuccess: () => setEditingTitle(false), preserveScroll: true },
    );
  };

  const deleteContent = (contentId) => {
    if (!confirm("Hapus konten ini?")) return;
    router.delete(
      route("instructor.classes.sections.contents.destroy", contentId),
      { preserveScroll: true },
    );
  };

  const byType = (type) =>
    (section.contents ?? []).filter((c) => c.type === type);

  return (
    <div className="border-2 border-gray-100 rounded-2xl overflow-hidden">
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
      {open && (
        <div className="p-4 space-y-5">
          <ContentBucket
            type="pre_assessment"
            contents={byType("pre_assessment")}
            courseId={courseId}
            sectionId={section.id}
            onDelete={deleteContent}
          />
          <ContentBucket
            type="material"
            contents={byType("material")}
            courseId={courseId}
            sectionId={section.id}
            onDelete={deleteContent}
          />
          <ContentBucket
            type="assignment"
            contents={byType("assignment")}
            courseId={courseId}
            sectionId={section.id}
            onDelete={deleteContent}
          />
          <SectionNotes
            notes={section.notes ?? []}
            courseId={courseId}
            sectionId={section.id}
          />
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
  const uploadDialogRef = useRef();

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
    if (!confirm("Hapus section ini beserta semua konten dan note-nya?"))
      return;
    router.delete(route("instructor.classes.sections.destroy", sectionId), {
      preserveScroll: true,
    });
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

        {/* Hero */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
          <div className="p-8 flex items-start gap-8">
            <div className="w-48 h-36 rounded-2xl overflow-hidden flex-shrink-0">
              <Avatar className="relative w-full h-auto border rounded-xl aspect-square  group">
                {course.thumbnail && (
                  <AvatarImage
                    src={
                      route("files.preview", course.thumbnail) +
                      `?v=${new Date(course.updated_at).getTime()}`
                    }
                    alt={course.name}
                    className={cn("transition-[filter] group-hover:blur-sm")}
                  />
                )}
                <AvatarFallback className="rounded-lg">
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
                </AvatarFallback>
                <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={() => uploadDialogRef.current?.open()}
                      >
                        <UploadIcon className="size-5!" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="center">Upload</TooltipContent>
                  </Tooltip>
                  {course.thumbnail && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" asChild>
                          <Link
                            href={route("instructor.image.delete")}
                            method="delete"
                          >
                            <Trash2Icon className="size-5!" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="center">Remove</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </Avatar>
            </div>
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
                onClick={() =>
                  router.patch(
                    route("instructor.classes.togglePublish", course.id),
                  )
                }
                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-xl transition-all border-2 ${course.status === "published" ? "border-gray-200 text-gray-500 hover:bg-gray-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
              >
                {course.status === "published" ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total Students"
            value={course.students_count ?? 0}
            accent="blue"
            icon={
              <svg
                className="w-5 h-5 text-blue-600"
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
        </div>

        {/* Sections */}
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
                  Belum ada section — tambah di atas
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
    </MainLayout>
  );
}
