// resources/js/Pages/Instructors/ManageClasses.jsx

import { useState } from "react";
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

// ── Create Course Modal ────────────────────────────────────────────────────────
function CreateCourseModal({ categories, onClose }) {
  const [step, setStep] = useState(1);
  const [sections, setSections] = useState([
    { id: 1, title: "", contents: [] },
  ]);

  const { data, setData, post, processing, errors } = useForm({
    title: "",
    description: "",
    price: "",
    level: "",
    category: "",
    total_hours: "",
    total_sessions: "",
    certificate_type: "",
    sections: [],
  });

  const isStep1Complete =
    data.title.trim() &&
    data.description.trim() &&
    data.price &&
    data.level &&
    data.category;

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

  const handleSubmit = () => {
    // merge sections ke form sebelum submit
    post(route("instructor.classes.store"), {
      data: { ...data, sections },
      onSuccess: onClose,
    });
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
                onClick={() => setStep(2)}
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
                onClick={handleSubmit}
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

// ── Course Card ────────────────────────────────────────────────────────────────
function CourseCard({ course }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = statusConfig[course.status] ?? statusConfig.draft;

  return (
    <div
      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-200 cursor-pointer
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-md"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      onClick={() => router.visit(route("instructor.classes.show", course.id))}
    >
      <div className="relative h-40 overflow-hidden">
        {course.image ? (
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-3 left-3">
          <span
            className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-lg ${config.bg} ${config.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>
        </div>
        {/* Menu button */}
        <div
          className="absolute top-3 right-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 w-40">
              <button
                onClick={() =>
                  router.visit(route("instructor.classes.show", course.id))
                }
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                View Detail
              </button>
              <button
                onClick={() =>
                  router.visit(route("instructor.classes.edit", course.id))
                }
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Edit Course
              </button>
              <button
                onClick={() =>
                  router.patch(
                    route("instructor.classes.togglePublish", course.id),
                  )
                }
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {course.status === "published" ? "Unpublish" : "Publish"}
              </button>
            </div>
          )}
        </div>
        <div className="absolute bottom-3 left-3">
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
            {course.categories?.[0]}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide leading-tight mb-3 line-clamp-2">
          {course.title}
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          <span>{course.total_hours}h</span>
          <span>·</span>
          <span>{course.total_sessions} sessions</span>
          <span>·</span>
          <span className="capitalize">{course.level}</span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Students
            </p>
            <p className="text-lg font-black text-gray-800">
              {course.students_count ?? 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Price
            </p>
            <p className="text-sm font-black text-blue-600">
              {formatRp(course.price)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Course Row ─────────────────────────────────────────────────────────────────
function CourseRow({ course }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = statusConfig[course.status] ?? statusConfig.draft;

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200 cursor-pointer
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-sm"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      onClick={() => router.visit(route("instructor.classes.show", course.id))}
    >
      <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-600 to-indigo-700">
        {course.image && (
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide leading-tight">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
          {course.categories?.[0]} · {course.total_hours}h ·{" "}
          {course.total_sessions} sessions ·{" "}
          <span className="capitalize">{course.level}</span>
        </p>
      </div>
      <div className="text-center flex-shrink-0 w-20">
        <p className="text-lg font-black text-gray-800">
          {course.students_count ?? 0}
        </p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Students
        </p>
      </div>
      <div className="flex-shrink-0 w-32 text-right">
        <p className="text-sm font-black text-blue-600">
          {formatRp(course.price)}
        </p>
      </div>
      <span
        className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-xl flex-shrink-0 ${config.bg} ${config.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
      <div
        className="relative flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 w-40">
            <button
              onClick={() =>
                router.visit(route("instructor.classes.show", course.id))
              }
              className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              View Detail
            </button>
            <button
              onClick={() =>
                router.visit(route("instructor.classes.edit", course.id))
              }
              className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Edit Course
            </button>
            <button
              onClick={() =>
                router.patch(
                  route("instructor.classes.togglePublish", course.id),
                )
              }
              className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {course.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
// Props: courses, categories, filters — dari InstructorCourseController@index
export default function ManageClasses({
  courses = [],
  categories = [],
  filters: initialFilters = {},
}) {
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [filterStatus, setFilterStatus] = useState(
    initialFilters.status ?? "all",
  );
  const [showCreate, setShowCreate] = useState(false);

  const applyFilter = (key, value) => {
    const next = { search, status: filterStatus, [key]: value };
    if (key === "status") setFilterStatus(value);
    if (key === "search") setSearch(value);
    router.get(route("instructor.classes.index"), next, {
      preserveState: true,
      replace: true,
    });
  };

  const stats = [
    {
      label: "Total Courses",
      value: courses.length,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Published",
      value: courses.filter((c) => c.status === "published").length,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Draft",
      value: courses.filter((c) => c.status === "draft").length,
      color: "text-gray-400",
      bg: "bg-gray-100",
    },
  ];

  return (
    <MainLayout title="Manage Classes" breadcrumb="Classes">
      <div className="p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-700 uppercase tracking-tight">
              Manage Classes
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Create and manage your training courses.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-3 text-xs font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all"
          >
            <svg
              className="w-4 h-4"
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
            Create Course
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`${s.bg} rounded-2xl px-5 py-4 flex items-center gap-3`}
            >
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-tight">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {["all", "published", "draft"].map((f) => (
              <button
                key={f}
                onClick={() => applyFilter("status", f)}
                className={`px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all capitalize
                  ${filterStatus === f ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <svg
                className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && applyFilter("search", search)
                }
                className="pl-9 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-xl w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-300"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {["grid", "list"].map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${viewMode === v ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {v === "grid" ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
                    </svg>
                  ) : (
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
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Course list */}
        {courses.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-3 gap-5">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {courses.map((c) => (
                <CourseRow key={c.id} course={c} />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <svg
              className="w-12 h-12 text-gray-200 mx-auto mb-3"
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
            <p className="text-sm font-bold uppercase tracking-widest text-gray-300">
              No courses found
            </p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCourseModal
          categories={categories}
          onClose={() => setShowCreate(false)}
        />
      )}
    </MainLayout>
  );
}
