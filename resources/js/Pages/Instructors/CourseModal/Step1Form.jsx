const inputClass =
  "w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all";
const labelClass =
  "block text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-2";

/**
 * Step1Form — Informasi dasar course.
 *
 * Props:
 *   data, setData    - dari useForm / useCourseForm
 *   errors           - validation errors
 *   categories       - array { id, slug, name }
 *   thumbnailRef     - ref untuk input file
 *   thumbnailPreview - URL preview atau null
 *   hasThumbnail     - true jika ada thumbnail (existing atau baru); kontrol tombol Hapus
 *   DEFAULT_THUMBNAIL
 *   onThumbnailChange
 *   onRemoveThumbnail
 */
export default function Step1Form({
  data,
  setData,
  errors,
  categories,
  thumbnailRef,
  thumbnailPreview,
  hasThumbnail,
  DEFAULT_THUMBNAIL,
  onThumbnailChange,
  onRemoveThumbnail,
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Thumbnail Upload ── */}
      <div>
        <label className={labelClass}>Thumbnail Course</label>
        <input
          ref={thumbnailRef}
          type="file"
          accept="image/jpg,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onThumbnailChange}
        />
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="w-28 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-border bg-muted relative">
            <img
              src={thumbnailPreview ?? DEFAULT_THUMBNAIL}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = DEFAULT_THUMBNAIL;
              }}
            />
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
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold tracking-widest uppercase bg-primary-soft text-primary border border-primary/30 rounded-xl hover:bg-primary-soft transition-all"
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
            {hasThumbnail && (
              <button
                type="button"
                onClick={onRemoveThumbnail}
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
            <p className="text-[9px] text-muted-foreground font-medium">
              JPG, PNG, WEBP • Maks. 2MB
              {!hasThumbnail && " • Logo default akan digunakan"}
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
          <p className="text-[10px] text-red-500 mt-1">{errors.title}</p>
        )}
      </div>

      {/* ── Description ── */}
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
          <p className="text-[10px] text-red-500 mt-1">{errors.description}</p>
        )}
      </div>

      {/* ── Category & Level ── */}
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
            <p className="text-[10px] text-red-500 mt-1">{errors.category}</p>
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
            <p className="text-[10px] text-red-500 mt-1">{errors.level}</p>
          )}
        </div>
      </div>

      {/* ── Price & Certificate ── */}
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
            <p className="text-[10px] text-red-500 mt-1">{errors.price}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Certificate Type</label>
          <select
            value={data.certificate_type}
            onChange={(e) => setData("certificate_type", e.target.value)}
            className={inputClass}
          >
            <option value="">Select type...</option>
            <option value="professional">Professional</option>
            <option value="competency">Competency</option>
            <option value="attendance">Attendance</option>
          </select>
        </div>
      </div>

      {/* ── Total Hours & Sessions ── */}
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
  );
}
