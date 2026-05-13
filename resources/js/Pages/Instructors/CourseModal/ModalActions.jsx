/**
 * ModalActions — Tombol navigasi dan submit di bagian bawah modal.
 *
 * Props:
 *   isEdit          {boolean}
 *   step            {number}
 *   isStep1Complete {boolean}
 *   processing      {boolean}
 *   onClose         {function}
 *   onBack          {function}  setStep(1)
 *   onNext          {function}  goToStep2
 *   onSubmit        {function}  handleSubmit
 */
export default function ModalActions({
  isEdit,
  step,
  isStep1Complete,
  processing,
  onClose,
  onBack,
  onNext,
  onSubmit,
}) {
  const btnBase =
    "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all";
  const btnSecondary =
    `${btnBase} border border-border text-muted-foreground hover:bg-muted`;
  const btnPrimary =
    `${btnBase} bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 hover:-translate-y-0.5`;
  const btnDisabled =
    `${btnBase} bg-muted text-muted-foreground cursor-not-allowed`;

  // Mode edit: hanya Cancel + Save
  if (isEdit) {
    return (
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={processing}
          className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {processing ? "Saving..." : "Save Changes"}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    );
  }

  // Mode create step 1
  if (step === 1) {
    return (
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          disabled={!isStep1Complete}
          onClick={onNext}
          className={isStep1Complete ? btnPrimary : btnDisabled}
        >
          Next Step
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // Mode create step 2
  return (
    <div className="flex gap-3 mt-6">
      <button onClick={onBack} className={btnSecondary}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <button
        onClick={onSubmit}
        disabled={processing}
        className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {processing ? "Saving..." : "Create Course"}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  );
}
