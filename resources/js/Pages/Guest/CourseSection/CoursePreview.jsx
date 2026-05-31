import { useState, useRef } from "react";
import { router, useForm } from "@inertiajs/react";
import GuestLayout from "@/Layouts/GuestLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn, formatRp } from "@/lib/utils";

function StarRating({ rating = 0, size = "w-4 h-4" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${size} ${s <= Math.round(rating) ? "text-amber-400" : "text-muted-foreground"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

// ── Content Type Icon ──────────────────────────────────────────────────────────
function ContentIcon({ type }) {
  if (type === "pre_assessment")
    return (
      <svg
        className="w-4 h-4 text-amber-400"
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
        className="w-4 h-4 text-violet-400"
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
      className="w-4 h-4 text-primary"
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

const contentTypeLabel = {
  pre_assessment: "Pre Assessment",
  material: "Materi",
  assignment: "Tugas",
};

// ── Enroll / Payment Modal ─────────────────────────────────────────────────────
function EnrollModal({ course, onClose }) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState(null);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef();

  const methods = [
    {
      id: "va",
      label: "Virtual Account",
      bank: "BCA / Mandiri / BNI",
      icon: "🏦",
    },
    {
      id: "tf",
      label: "Transfer Bank",
      bank: "BRI / BSI / Permata",
      icon: "💳",
    },
    { id: "qris", label: "QRIS", bank: "Semua e-wallet", icon: "📱" },
  ];

  const instructions = {
    va: [
      "Salin nomor VA: 8277-0812-3456-7890",
      "Buka aplikasi mobile banking Anda",
      "Pilih menu Pembayaran → Virtual Account",
      "Masukkan nomor VA dan konfirmasi",
      "Simpan bukti transfer",
    ],
    tf: [
      `Transfer ke: BRI 0123-01-234567-56-8 a.n. INKINDO`,
      `Nominal tepat: ${formatRp(course.price)}`,
      "Berita: Nama Lengkap + Kode Kelas",
      "Simpan bukti transfer",
    ],
    qris: [
      `Scan QR Code di bawah ini`,
      `Masukkan nominal: ${formatRp(course.price)}`,
      "Konfirmasi pembayaran",
      "Screenshot bukti pembayaran",
    ],
  };

  const submitPayment = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("course_ids[]", course.id);
    formData.append("payment_method", method);
    formData.append("payment_proof", file);
    formData.append("notes", note);
    router.post(route("student.enroll"), formData, {
      forceFormData: true,
      onSuccess: () => setDone(true),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(15,23,42,0.5)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-card/10 text-white/60 hover:bg-card/20 hover:text-white transition-all"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <p className="text-[9px] font-black tracking-widest text-primary uppercase mb-1">
            Enroll Kelas
          </p>
          <h3 className="text-sm font-black text-white leading-snug pr-8">
            {course.title}
          </h3>
          <div className="flex flex-col text-lg font-black text-primary mt-2">
            <span
              className={cn(
                "font-black text-primary",
                course.discount > 0 &&
                  "line-through text-muted-foreground text-sm",
              )}
            >
              {formatRp(course.price)}
            </span>
            {course.discount > 0 && (
              <span className="font-black text-primary">
                {course.discount_type === "percentage"
                  ? formatRp(
                      course.price - (course.price * course.discount) / 100,
                    )
                  : formatRp(course.price - course.discount)}
              </span>
            )}
          </div>
          {/* Step indicator */}
          {!done && (
            <div className="flex items-center gap-2 mt-4">
              {["Metode", "Instruksi", "Upload"].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all
                    ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-primary-soft0 text-white" : "bg-card/10 text-white/40"}`}
                  >
                    {step > i + 1 ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-[9px] font-bold tracking-widest uppercase ${step === i + 1 ? "text-white" : "text-white/30"}`}
                  >
                    {s}
                  </span>
                  {i < 2 && (
                    <div
                      className={`w-6 h-px ${step > i + 1 ? "bg-green-500" : "bg-card/10"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {done ? (
            <div className="py-4 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-500"
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
              </div>
              <div>
                <p className="text-sm font-black text-foreground uppercase tracking-wide">
                  Bukti Terkirim!
                </p>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  Pendaftaran sedang diverifikasi admin. Proses 1×24 jam kerja.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 w-full">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                  ⏳ Menunggu Verifikasi
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
              >
                Tutup
              </button>
            </div>
          ) : (
            <>
              {/* Step 1 */}
              {step === 1 && (
                <>
                  <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                    Pilih Metode Pembayaran
                  </p>
                  <div className="space-y-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left
                          ${method === m.id ? "border-primary/50 bg-primary-soft" : "border-border hover:border-border"}`}
                      >
                        <span className="text-2xl">{m.icon}</span>
                        <div>
                          <p className="text-xs font-black text-foreground uppercase tracking-wide">
                            {m.label}
                          </p>
                          <p className="text-[9px] text-muted-foreground font-medium">
                            {m.bank}
                          </p>
                        </div>
                        {method === m.id && (
                          <div className="ml-auto w-5 h-5 rounded-full bg-primary-soft0 flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
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
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={!method}
                    onClick={() => setStep(2)}
                    className="w-full py-3 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Lanjutkan →
                  </button>
                </>
              )}

              {/* Step 2 */}
              {step === 2 && method && (
                <>
                  <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                    Instruksi Pembayaran
                  </p>
                  <div className="bg-muted rounded-2xl border border-border p-4 space-y-2.5">
                    {instructions[method].map((ins, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[9px] font-black text-primary">
                            {i + 1}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground">
                          {ins}
                        </p>
                      </div>
                    ))}
                  </div>
                  {method === "qris" && (
                    <div className="flex justify-center">
                      <div className="w-32 h-32 bg-muted rounded-2xl flex items-center justify-center border-2 border-dashed border-border">
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest text-center">
                          QR Code
                          <br />
                          Placeholder
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground transition-all"
                    >
                      ← Kembali
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
                    >
                      Sudah Bayar →
                    </button>
                  </div>
                </>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <>
                  <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                    Upload Bukti Pembayaran
                  </p>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all
                      ${file ? "border-primary/40 bg-primary-soft" : "border-border hover:border-primary/35 hover:bg-muted"}`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files[0])}
                    />
                    {file ? (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-primary-soft0 flex items-center justify-center">
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
                        <p className="text-xs font-black text-primary text-center">
                          {file.name}
                        </p>
                        <p className="text-[9px] text-primary font-medium">
                          Klik untuk ganti file
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-muted-foreground"
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
                        <p className="text-xs font-black text-muted-foreground text-center">
                          Klik untuk upload bukti
                        </p>
                        <p className="text-[9px] text-muted-foreground font-medium">
                          JPG, PNG, atau PDF • Maks. 5MB
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1.5">
                      Catatan (opsional)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Tambahkan catatan jika diperlukan..."
                      className="w-full text-xs text-foreground bg-muted border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all placeholder-muted-foreground"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground transition-all"
                    >
                      ← Kembali
                    </button>
                    <button
                      disabled={!file}
                      onClick={submitPayment}
                      className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Kirim →
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section Accordion ──────────────────────────────────────────────────────────
function SectionAccordion({ section, index, isEnrolled }) {
  const [open, setOpen] = useState(index === 0);

  const byType = (type) =>
    (section.contents ?? []).filter((c) => c.type === type);

  const typeCfg = {
    pre_assessment: {
      label: "Pre Assessment",
      bg: "bg-amber-50",
      border: "border-amber-100",
      text: "text-amber-600",
    },
    material: {
      label: "Materi",
      bg: "bg-primary-soft",
      border: "border-primary/20",
      text: "text-primary",
    },
    assignment: {
      label: "Tugas",
      bg: "bg-violet-50",
      border: "border-violet-100",
      text: "text-violet-600",
    },
  };

  const ContentRow = ({ content, cfg }) => (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}
    >
      <ContentIcon type={content.type} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate">
          {content.title}
        </p>
        {content.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {content.description}
          </p>
        )}
      </div>
      <span
        className={`text-[9px] font-black tracking-widest uppercase flex-shrink-0 ${cfg.text}`}
      >
        {cfg.label}
      </span>
      {/* Download — hanya jika enrolled dan ada file/url */}
      {isEnrolled && (content.file_url || content.url) && (
        <a
          href={content.file_url ?? content.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black tracking-widest uppercase text-primary bg-card border border-primary/30 rounded-lg hover:bg-primary-soft transition-all flex-shrink-0"
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
          Unduh
        </a>
      )}
      {/* Lock icon — belum enrolled dan ada file */}
      {!isEnrolled && (content.file_url || content.url) && (
        <span className="flex items-center gap-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest flex-shrink-0">
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Terkunci
        </span>
      )}
    </div>
  );

  const hasContent = Object.keys(typeCfg).some((t) => byType(t).length > 0);

  return (
    <div
      className={`border-2 rounded-2xl overflow-hidden transition-all ${open ? "border-primary/40" : "border-border"}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-card hover:bg-muted transition-colors text-left"
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${open ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`text-xs font-black ${open ? "text-white" : "text-muted-foreground"}`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground uppercase tracking-wide truncate">
            {section.title}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
            {(section.contents ?? []).length} item
            {(section.contents ?? []).length !== 1 ? "s" : ""}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
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
        <div className="border-t border-border bg-muted/60 p-4 space-y-4">
          {!hasContent ? (
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center py-4">
              Belum ada konten
            </p>
          ) : (
            Object.entries(typeCfg).map(([type, cfg]) => {
              const items = byType(type);
              if (items.length === 0) return null;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ContentIcon type={type} />
                    <span
                      className={`text-[10px] font-black tracking-widest uppercase ${cfg.text}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-bold">
                      ({items.length})
                    </span>
                  </div>
                  {items.map((content) => (
                    <ContentRow key={content.id} content={content} cfg={cfg} />
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
// Props dari TrainingController@show:
// course = { id, title, description, price, level, language, total_hours, total_sessions,
//            certificate_type, instructor, categories, sections[], image, rating?, reviews_count? }
// isEnrolled = bool — apakah user yang login sudah terdaftar
// isLoggedIn  = bool — apakah user sudah login
export default function TrainingPreview({
  course,
  isEnrolled = false,
  isLoggedIn = false,
  enrollmentStatus = "",
  rejectionReason = null,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [openChapter, setOpenChapter] = useState(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const isPending = enrollmentStatus === "pending";
  const isRejected = enrollmentStatus === "rejected";

  const tabs = ["overview", "curriculum", "instructor", "reviews"];

  const levelColor = {
    beginner: "bg-green-100 text-green-700",
    intermediate: "bg-amber-100 text-amber-700",
    advanced: "bg-red-100 text-red-700",
  };

  const handleEnrollClick = () => {
    if (!isLoggedIn) {
      router.visit(route("guest.home") + "?login=1");
      return;
    }

    if (isPending) {
      return;
    }

    setShowEnroll(true);
  };

  return (
    <GuestLayout>
      <div className="min-h-screen bg-card">
        {/* ── Hero ── */}
        <div className="relative">
          <div className="absolute inset-0">
            <Avatar className="relative w-full h-96 border rounded-xl aspect-square  group">
              {course.thumbnail && (
                <AvatarImage
                  src={
                    route("files.preview", course.thumbnail) +
                    `?v=${new Date(course.updated_at).getTime()}`
                  }
                  alt={course.name}
                />
              )}
              <AvatarFallback className="rounded-lg bg-transparent">
                <img
                  src="/storage/images/logo-default.png"
                  alt={course.title}
                  className="w-full h-full object-contain"
                />
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/92 via-gray-900/70 to-gray-900/30" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-xs font-bold tracking-widest text-white/60 uppercase hover:text-white transition-colors mb-8"
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
              Back to Catalogue
            </button>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {course.categories?.map((cat) => (
                <span
                  key={cat}
                  className="px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase bg-primary text-white"
                >
                  {cat}
                </span>
              ))}
              {course.level && (
                <span
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase capitalize ${levelColor[course.level] ?? "bg-muted text-foreground"}`}
                >
                  {course.level}
                </span>
              )}
              {isEnrolled && (
                <span className="px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase bg-green-500 text-white flex items-center gap-1.5">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Terdaftar
                </span>
              )}
              {isPending && (
                <span className="px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase bg-amber-500 text-white">
                  Menunggu Verifikasi
                </span>
              )}
              {isRejected && (
                <span className="px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase bg-red-500 text-white">
                  Ditolak
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight uppercase max-w-2xl mb-5">
              {course.title}
            </h1>
            <p className="text-base text-white/70 leading-relaxed max-w-2xl mb-8">
              {course.description}
            </p>

            <div className="flex items-center gap-6 flex-wrap text-sm text-white/70">
              {course.rating && (
                <div className="flex items-center gap-2">
                  <StarRating rating={course.rating} />
                  <span className="font-black text-amber-400">
                    {course.rating}
                  </span>
                  {course.reviews_count && (
                    <span className="text-white/50">
                      ({course.reviews_count} reviews)
                    </span>
                  )}
                </div>
              )}
              {course.students_count !== undefined && (
                <span className="flex items-center gap-1.5">
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {course.students_count.toLocaleString("id-ID")} students
                  </span>
                </span>
              )}
              {course.total_hours && (
                <span className="flex items-center gap-1.5">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {course.total_hours} Jam
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky Tabs ── */}
        <div className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
          <div className="max-w-6xl mx-auto px-6 flex items-center gap-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-xs font-extrabold tracking-widest uppercase border-b-2 transition-all duration-200 capitalize
                  ${activeTab === tab ? "border-primary/50 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-3 gap-10">
            {/* ── Left — Tab content ── */}
            <div className="col-span-2 space-y-10">
              {/* Overview */}
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {/* Deskripsi lengkap */}
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight mb-4">
                      Tentang Kelas
                    </h2>
                    <p className="text-sm text-foreground leading-relaxed">
                      {course.description}
                    </p>
                  </div>

                  {/* Info kelas */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        label: "Total Jam",
                        value: course.total_hours
                          ? `${course.total_hours} Jam`
                          : "-",
                      },
                      {
                        label: "Total Sesi",
                        value: course.total_sessions
                          ? `${course.total_sessions} Sesi`
                          : "-",
                      },
                      {
                        label: "Level",
                        value: course.level ? course.level : "-",
                      },
                      {
                        label: "Bahasa",
                        value: course.language ?? "Bahasa Indonesia",
                      },
                      {
                        label: "Sertifikat",
                        value: course.certificate_type ?? "-",
                      },
                      { label: "Instruktur", value: course.instructor ?? "-" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 p-4 bg-muted rounded-xl"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                            {item.label}
                          </p>
                          <p className="text-sm font-black text-foreground mt-0.5 capitalize">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Konten kelas overview */}
                  <div className="bg-muted rounded-2xl p-6 border border-border">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-tight mb-4">
                      Kelas ini meliputi:
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          icon: "clock",
                          label: `${course.total_hours ?? "-"} Jam materi`,
                        },
                        {
                          icon: "session",
                          label: `${course.total_sessions ?? "-"} Sesi pembelajaran`,
                        },
                        {
                          icon: "cert",
                          label: course.certificate_type
                            ? `Sertifikat ${course.certificate_type}`
                            : "Tanpa sertifikat",
                        },
                        {
                          icon: "access",
                          label: "Akses materi setelah terdaftar",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center flex-shrink-0">
                            {item.icon === "clock" && (
                              <svg
                                className="w-4 h-4 text-primary"
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
                            )}
                            {item.icon === "session" && (
                              <svg
                                className="w-4 h-4 text-primary"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                                />
                              </svg>
                            )}
                            {item.icon === "cert" && (
                              <svg
                                className="w-4 h-4 text-primary"
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
                            )}
                            {item.icon === "access" && (
                              <svg
                                className="w-4 h-4 text-primary"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                                />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Curriculum */}
              {activeTab === "curriculum" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                      Kurikulum
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-bold uppercase tracking-widest">
                      <span>{course.sections?.length ?? 0} Sections</span>
                      <span>·</span>
                      <span>
                        {course.sections?.reduce(
                          (s, sec) => s + (sec.contents?.length ?? 0),
                          0,
                        ) ?? 0}{" "}
                        Konten
                      </span>
                    </div>
                  </div>

                  {/* Enrolled banner */}
                  {isEnrolled && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-green-500 flex-shrink-0"
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
                      <p className="text-xs font-bold text-green-700">
                        Anda sudah terdaftar — semua materi dapat diunduh.
                      </p>
                    </div>
                  )}

                  {isPending && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-amber-500 flex-shrink-0"
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
                      <p className="text-xs font-bold text-amber-700">
                        Bukti pembayaran Anda sedang diverifikasi admin.
                      </p>
                    </div>
                  )}

                  {isRejected && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3">
                      <p className="text-xs font-black text-red-700 uppercase tracking-widest">
                        Pembayaran ditolak
                      </p>
                      {rejectionReason && (
                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                          Alasan: {rejectionReason}
                        </p>
                      )}
                    </div>
                  )}

                  {!isEnrolled && !isPending && !isRejected && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-amber-500 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <p className="text-xs font-bold text-amber-700">
                        Enroll untuk mengakses dan mengunduh semua materi,
                        tugas, dan pra asesmen.
                      </p>
                    </div>
                  )}

                  {course.sections?.length > 0 ? (
                    course.sections.map((section, i) => (
                      <SectionAccordion
                        key={section.id}
                        section={section}
                        index={i}
                        isEnrolled={isEnrolled}
                      />
                    ))
                  ) : (
                    <div className="bg-muted rounded-2xl border border-border py-16 flex flex-col items-center gap-3">
                      <svg
                        className="w-10 h-10 text-muted-foreground"
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
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Belum ada konten
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Instructor */}
              {activeTab === "instructor" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                    Instruktur
                  </h2>
                  <div className="flex items-start gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-white text-3xl font-black flex-shrink-0">
                      {course.instructor?.slice(0, 1) ?? "I"}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-foreground">
                        {course.instructor ?? "-"}
                      </h3>
                      <p className="text-sm text-primary font-semibold mt-0.5">
                        Instruktur INKINDO
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews */}
              {activeTab === "reviews" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                    Ulasan
                  </h2>
                  {course.rating ? (
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-6xl font-black text-foreground">
                          {course.rating}
                        </p>
                        <StarRating rating={course.rating} size="w-5 h-5" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {course.reviews_count ?? 0} ulasan
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Belum ada ulasan untuk kelas ini.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Right — Sticky Card ── */}
            <div className="col-span-1">
              <div className="sticky top-20">
                <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
                  <div className="p-6">
                    {isEnrolled ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="text-xs font-black text-green-600 uppercase tracking-widest">
                            Terdaftar
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Anda sudah terdaftar di kelas ini. Akses semua materi
                          di halaman My Learning.
                        </p>
                        <button
                          onClick={() =>
                            router.visit(route("student.courses.index"))
                          }
                          className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all"
                        >
                          Buka My Learning
                        </button>
                      </div>
                    ) : isPending ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="text-xs font-black text-amber-600 uppercase tracking-widest">
                            Pending
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Bukti pembayaran sudah dikirim dan sedang menunggu
                          verifikasi admin.
                        </p>
                      </div>
                    ) : isRejected ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          <span className="text-xs font-black text-red-600 uppercase tracking-widest">
                            Rejected
                          </span>
                        </div>
                        {rejectionReason && (
                          <p className="text-xs text-red-600 leading-relaxed">
                            Alasan: {rejectionReason}
                          </p>
                        )}
                        <button
                          onClick={handleEnrollClick}
                          className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all"
                        >
                          Upload Ulang Bukti
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col text-3xl font-black text-foreground">
                          <span
                            className={cn(
                              "font-black text-primary",
                              course.discount > 0 &&
                                "line-through text-muted-foreground text-sm",
                            )}
                          >
                            {formatRp(course.price)}
                          </span>
                          {course.discount > 0 && (
                            <span className="font-black text-primary">
                              {course.discount_type === "percentage"
                                ? formatRp(
                                    course.price -
                                      (course.price * course.discount) / 100,
                                  )
                                : formatRp(course.price - course.discount)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mt-1">
                          One-Time Payment • Full Access
                        </p>
                        <div className="flex flex-col gap-3 mt-5">
                          <button
                            onClick={handleEnrollClick}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all"
                          >
                            {isLoggedIn
                              ? "Enroll Sekarang"
                              : "Login untuk Enroll"}
                          </button>
                        </div>
                      </>
                    )}

                    {/* Course details */}
                    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
                      {[
                        {
                          label: "Durasi",
                          value: course.total_hours
                            ? `${course.total_hours} Jam`
                            : "-",
                        },
                        {
                          label: "Sesi",
                          value: course.total_sessions
                            ? `${course.total_sessions} Sesi`
                            : "-",
                        },
                        {
                          label: "Bahasa",
                          value: course.language ?? "Indonesia",
                        },
                        {
                          label: "Sertifikat",
                          value: course.certificate_type ?? "-",
                        },
                        { label: "Level", value: course.level ?? "-" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                            {item.label}
                          </span>
                          <span className="text-sm font-black text-foreground capitalize">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEnroll && (
        <EnrollModal course={course} onClose={() => setShowEnroll(false)} />
      )}
    </GuestLayout>
  );
}
