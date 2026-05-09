import { useRef, useState } from "react";
import { router, useForm } from "@inertiajs/react";
import { inputClass, labelClass } from "./CourseDetailConfig";

export default function CourseDetailEditModal({ course, categories, onClose }) {
  const thumbnailRef = useRef();
  const [thumbnailPreview, setThumbnailPreview] = useState(
    course.thumbnail ?? null,
  );
  const [thumbnailFile, setThumbnailFile] = useState(null);

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

  const handleThumbnailChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);

    if (thumbnailRef.current) {
      thumbnailRef.current.value = "";
    }
  };

  const submit = () => {
    const formData = new FormData();
    formData.append("_method", "PUT");
    formData.append("title", data.title);
    formData.append("description", data.description);
    formData.append("price", data.price);
    formData.append("level", data.level);
    formData.append("category", data.category);
    formData.append("total_hours", data.total_hours ?? "");
    formData.append("total_sessions", data.total_sessions ?? "");
    formData.append("certificate_type", data.certificate_type ?? "");

    if (thumbnailFile instanceof File) {
      formData.append("thumbnail", thumbnailFile);
    }

    router.post(route("instructor.classes.update", course.id), formData, {
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
            <label className={labelClass}>Thumbnail Course</label>
            <input
              ref={thumbnailRef}
              type="file"
              accept="image/jpg,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnailChange}
            />
            <div className="flex items-center gap-4">
              <div className="w-32 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-gray-100 bg-gray-50 relative">
                {thumbnailPreview ? (
                  <>
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
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
                  JPG, PNG, WEBP - Maks. 2MB
                  {!thumbnailFile &&
                    !thumbnailPreview &&
                    " - Logo default akan digunakan"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Course Title</label>
            <input
              type="text"
              value={data.title}
              onChange={(event) => setData("title", event.target.value)}
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
              onChange={(event) => setData("description", event.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={data.category}
                onChange={(event) => setData("category", event.target.value)}
                className={inputClass}
              >
                <option value="">Select...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Level</label>
              <select
                value={data.level}
                onChange={(event) => setData("level", event.target.value)}
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
                onChange={(event) => setData("price", event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Certificate Type</label>
              <select
                value={data.certificate_type}
                onChange={(event) =>
                  setData("certificate_type", event.target.value)
                }
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
                onChange={(event) => setData("total_hours", event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Total Sessions</label>
              <input
                type="number"
                value={data.total_sessions}
                onChange={(event) =>
                  setData("total_sessions", event.target.value)
                }
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
