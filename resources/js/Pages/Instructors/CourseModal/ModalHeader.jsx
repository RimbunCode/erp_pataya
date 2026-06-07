/**
 * ModalHeader
 *
 * Menampilkan judul, subtitle step, tombol close, dan step indicator.
 *
 * Props:
 *   isEdit   {boolean}  - true = mode edit (single-step, tidak tampilkan step indicator)
 *   step     {number}   - step aktif (1 atau 2)
 *   onClose  {function} - callback tutup modal
 */
export default function ModalHeader({ isEdit, onClose }) {
  return (
    <div className="p-8 pb-6 flex-shrink-0">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Icon + judul */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
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
          <h3 className="text-lg font-black text-foreground uppercase tracking-tight">
            {isEdit ? "Edit Course" : "Create New Course"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isEdit ? "Update course information" : "Fill in the course information below"}
          </p>
        </div>
      </div>
    </div>
  );
}
