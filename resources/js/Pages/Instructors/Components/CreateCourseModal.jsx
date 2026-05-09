import { useState, useRef } from "react";
import { router, useForm, usePage } from "@inertiajs/react";

export default function CreateCourseModal({ categories, onClose }) {
  const { course } = usePage().props;
  const [step, setStep] = useState(1);
  const [sections, setSections] = useState([
    { id: 1, title: "", contents: [] },
  ]);
  const DEFAULT_THUMBNAIL = "/images/logo-default.png";

  const thumbnailRef = useRef();
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const { data, setData, post, processing, errors } = useForm({
    title: "",
    description: "",
    price: "",
    level: "",
    category: "",
    total_hours: "",
    total_sessions: "",
    certificate_type: "",
    thumbnail: course?.thumbnail ?? null,
  });

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setData("thumbnail", file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    setData("thumbnail", null);
    setThumbnailPreview(null);
    if (thumbnailRef.current) thumbnailRef.current.value = "";
  };

  // SESUDAH
  const isStep1Complete =
    data.title.trim() &&
    data.description.trim() &&
    data.price &&
    data.level &&
    data.category;

  const goToStep2 = () => {
    const count = parseInt(data.total_sessions) || 1;
    setSections(
      Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        title: `Section ${i + 1}`,
        contents: [],
      })),
    );
    setStep(2);
  };

  const inputClass =
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all";
  const labelClass =
    "block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2";

  // Section helpers
  const addSection = () =>
    setSections((p) => [...p, { id: Date.now(), title: "", contents: [] }]);
  const removeSection = (id) =>
    setSections((p) => p.filter((s) => s.id !== id));
  const updateSection = (id, value) =>
    setSections((p) =>
      p.map((s) => (s.id === id ? { ...s, title: value } : s)),
    );
  const addContent = (sid) =>
    setSections((p) =>
      p.map((s) =>
        s.id === sid
          ? {
              ...s,
              contents: [
                ...s.contents,
                { id: Date.now(), title: "", type: "material" },
              ],
            }
          : s,
      ),
    );
  const removeContent = (sid, cid) =>
    setSections((p) =>
      p.map((s) =>
        s.id === sid
          ? { ...s, contents: s.contents.filter((c) => c.id !== cid) }
          : s,
      ),
    );
  const updateContent = (sid, cid, field, value) =>
    setSections((p) =>
      p.map((s) =>
        s.id === sid
          ? {
              ...s,
              contents: s.contents.map((c) =>
                c.id === cid ? { ...c, [field]: value } : c,
              ),
            }
          : s,
      ),
    );

  const handleSubmitDirect = () => {
    const cleanedSections = sections.map(({ title, contents }) => ({
      title,
      contents: contents.map(({ title, type }) => ({ title, type })),
    }));

    router.post(
      route("instructor.classes.store"),
      {
        ...data,
        sections: cleanedSections,
      },
      {
        onSuccess: onClose,
        preserveScroll: true,
        forceFormData: true,
      },
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-500 flex-shrink-0" />

        <div className="p-8 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"
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

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
                Create New Course
              </h3>
              <p className="text-xs text-gray-400">
                Step {step} of 2 —{" "}
                {step === 1 ? "Course Information" : "Sections & Content"}
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all
                  ${step === s ? "bg-blue-600 text-white shadow-md shadow-blue-200" : step > s ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}
                >
                  {step > s ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 2 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full ${step > s ? "bg-green-400" : "bg-gray-100"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-8 pb-8">
          {/* Step 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {/* ── Thumbnail Upload ── */}
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
                  {/* Preview box */}
                  <div className="w-28 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-gray-100 bg-gray-50 relative">
                    <img
                      src={thumbnailPreview ?? DEFAULT_THUMBNAIL}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = DEFAULT_THUMBNAIL;
                      }}
                    />
                    {/* overlay label "default" jika belum upload */}
                    {!thumbnailPreview && (
                      <div className="absolute inset-0 flex items-end justify-center pb-1.5 bg-gradient-to-t from-black/30 to-transparent">
                        <span className="text-[8px] font-black text-white/80 uppercase tracking-widest">
                          Default
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Buttons */}
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
                        Hapus
                      </button>
                    )}
                    <p className="text-[9px] text-gray-300 font-medium">
                      JPG, PNG, WEBP • Maks. 2MB
                      {!thumbnailPreview && " • Logo default akan digunakan"}
                    </p>
                  </div>
                </div>
              </div>
              {/* ── Course Title ── */}
              <div>
                <label className={labelClass}>Course Title</label>
                <input
                  type="text"
                  value={data.title}
                  onChange={(e) => setData("title", e.target.value)}
                  placeholder="e.g. Advanced Project Planning & Control"
                  className={inputClass}
                />
                {errors.title && (
                  <p className="text-[10px] text-red-500 mt-1">
                    {errors.title}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={data.description}
                  onChange={(e) => setData("description", e.target.value)}
                  rows={3}
                  placeholder="Describe what students will learn..."
                  className={`${inputClass} resize-none`}
                />
                {errors.description && (
                  <p className="text-[10px] text-red-500 mt-1">
                    {errors.description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={data.category}
                    onChange={(e) => setData("category", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-[10px] text-red-500 mt-1">
                      {errors.category}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Level</label>
                  <select
                    value={data.level}
                    onChange={(e) => setData("level", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select level...</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  {errors.level && (
                    <p className="text-[10px] text-red-500 mt-1">
                      {errors.level}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Price (IDR)</label>
                  <input
                    type="number"
                    value={data.price}
                    onChange={(e) => setData("price", e.target.value)}
                    placeholder="e.g. 2500000"
                    className={inputClass}
                  />
                  {errors.price && (
                    <p className="text-[10px] text-red-500 mt-1">
                      {errors.price}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Certificate Type</label>
                  <select
                    value={data.certificate_type}
                    onChange={(e) =>
                      setData("certificate_type", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select type...</option>
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
                    placeholder="e.g. 24"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Total Sessions</label>
                  <input
                    type="number"
                    value={data.total_sessions}
                    onChange={(e) => setData("total_sessions", e.target.value)}
                    placeholder="e.g. 8"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500">
                  Add sections and content for your course.
                </p>
                <button
                  onClick={addSection}
                  className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase text-blue-600 hover:text-blue-700 transition-colors"
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

              {sections.map((section, si) => (
                <div
                  key={section.id}
                  className="border-2 border-gray-100 rounded-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-black text-white">
                        {String(si + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        updateSection(section.id, e.target.value)
                      }
                      placeholder="Section title..."
                      className="flex-1 bg-transparent text-sm font-bold text-gray-700 placeholder-gray-300 focus:outline-none"
                    />
                    {sections.length > 1 && (
                      <button
                        onClick={() => removeSection(section.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    {section.contents.map((content) => (
                      <div key={content.id} className="flex items-center gap-2">
                        <select
                          value={content.type}
                          onChange={(e) =>
                            updateContent(
                              section.id,
                              content.id,
                              "type",
                              e.target.value,
                            )
                          }
                          className="w-36 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="pre_assessment">Pre Assessment</option>
                          <option value="material">Material</option>
                          <option value="assignment">Assignment</option>
                        </select>
                        <input
                          type="text"
                          value={content.title}
                          onChange={(e) =>
                            updateContent(
                              section.id,
                              content.id,
                              "title",
                              e.target.value,
                            )
                          }
                          placeholder="Content title..."
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        <button
                          onClick={() => removeContent(section.id, content.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
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
                    ))}
                    <button
                      onClick={() => addContent(section.id)}
                      className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold tracking-widest uppercase text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
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
                      Add Content
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            {step === 1 ? (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-500 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
            )}
            {step === 1 ? (
              <button
                disabled={!isStep1Complete}
                onClick={goToStep2}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all
                    ${isStep1Complete ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
              >
                Next Step
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmitDirect}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {processing ? "Saving..." : "Create Course"}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
