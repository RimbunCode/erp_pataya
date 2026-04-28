// resources/js/Pages/Student/CourseList.jsx
// Layout: MainLayout title="My Learning" breadcrumb="Courses"

import MainLayout from "@/Layouts/MainLayout";
import { useState, useRef } from "react";

// ── Mock Data ──────────────────────────────────────────────────────────────────
const coursesData = [
  {
    id: 1,
    title: "BIM Mastery for Structural Engineers",
    instructor: "Ir. Ahmad Sudirman",
    category: "Building Information Modeling",
    price: "Rp 1.250.000",
    duration: "12 Minggu",
    enrolled: true,
    progress: 65,
    thumbnail: "BM",
    color: "bg-blue-600",
    praAsesmen: {
      description:
        "Selesaikan pra asesmen ini sebelum memulai kelas. Jawab semua soal dengan jujur sesuai kemampuan Anda saat ini.",
      fileUrl: "#",
      submitted: false,
    },
    modules: [
      { id: 1, title: "Pengantar BIM & Revit Dasar", fileUrl: "#" },
      { id: 2, title: "Pemodelan Struktural 3D", fileUrl: "#" },
      { id: 3, title: "Koordinasi Antar Disiplin", fileUrl: "#" },
    ],
    tugas: [
      {
        id: 1,
        title: "Tugas 1 — Model Rumah Sederhana",
        description: "Buat model rumah 2 lantai menggunakan Revit...",
        fileUrl: "#", // ← ada file soal
        submitted: false,
      },
      {
        id: 2,
        title: "Tugas 2 — Koordinasi MEP & Struktur",
        description: "Lakukan clash detection antara sistem MEP...",
        fileUrl: null, // ← hanya instruksi, tidak ada file
        submitted: true,
      },
    ],
  },
  {
    id: 2,
    title: "Advanced Project Planning & Control",
    instructor: "Dr. Siti Aminah",
    category: "Project Management",
    price: "Rp 980.000",
    duration: "8 Minggu",
    enrolled: true,
    progress: 100,
    thumbnail: "AP",
    color: "bg-green-600",
    praAsesmen: null,
    modules: [
      { id: 1, title: "Dasar-Dasar Perencanaan Proyek", fileUrl: "#" },
      { id: 2, title: "Critical Path Method (CPM)", fileUrl: "#" },
      { id: 3, title: "Earned Value Management", fileUrl: "#" },
      { id: 4, title: "Risk Management & Mitigation", fileUrl: "#" },
    ],
    tugas: [
      {
        id: 1,
        title: "Tugas Akhir — Studi Kasus Proyek",
        description:
          "Analisis studi kasus proyek konstruksi yang mengalami keterlambatan. Identifikasi penyebab dan buat rencana mitigasi.",
        submitted: true,
      },
    ],
  },
  {
    id: 3,
    title: "Ethics and Professionalism",
    instructor: "Inkindo Board",
    category: "Professional Development",
    price: "Rp 500.000",
    duration: "4 Minggu",
    enrolled: false,
    progress: 0,
    thumbnail: "EP",
    color: "bg-violet-600",
    praAsesmen: {
      description:
        "Pra asesmen ini bertujuan mengukur pemahaman awal Anda tentang etika profesi insinyur.",
      fileUrl: "#",
      submitted: false,
    },
    modules: [
      { id: 1, title: "Kode Etik Insinyur Indonesia", fileUrl: "#" },
      { id: 2, title: "Tanggung Jawab Profesional", fileUrl: "#" },
    ],
    tugas: [
      {
        id: 1,
        title: "Refleksi Etika Profesi",
        description:
          "Tulis essay reflektif (min. 1000 kata) tentang pentingnya etika dalam praktik rekayasa.",
        submitted: false,
      },
    ],
  },
];

// ── Enroll / Payment Modal ─────────────────────────────────────────────────────
function EnrollModal({ course, onClose }) {
  const [step, setStep] = useState(1); // 1=pilih metode, 2=instruksi, 3=upload bukti, 4=sukses
  const [method, setMethod] = useState(null);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
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
      "Masukkan nomor VA dan konfirmasi pembayaran",
      "Simpan bukti transfer",
    ],
    tf: [
      "Transfer ke: BRI 0123-01-234567-56-8 a.n. INKINDO",
      "Nominal tepat: " + course.price,
      "Berita: Nama Lengkap + Kode Kelas",
      "Simpan bukti transfer",
    ],
    qris: [
      "Scan QR Code di bawah ini",
      "Masukkan nominal: " + course.price,
      "Konfirmasi pembayaran",
      "Screenshot bukti pembayaran",
    ],
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all"
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
          <p className="text-[9px] font-black tracking-widest text-blue-400 uppercase mb-1">
            Enroll Kelas
          </p>
          <h3 className="text-sm font-black text-white leading-snug pr-8">
            {course.title}
          </h3>
          <p className="text-lg font-black text-blue-400 mt-2">
            {course.price}
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {["Metode", "Instruksi", "Upload"].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all
                  ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-blue-500 text-white" : "bg-white/10 text-white/40"}`}
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
                    className={`w-6 h-px ${step > i + 1 ? "bg-green-500" : "bg-white/10"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Step 1 — Pilih metode */}
          {step === 1 && (
            <>
              <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase">
                Pilih Metode Pembayaran
              </p>
              <div className="space-y-2">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left
                      ${method === m.id ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="text-xs font-black text-gray-800 uppercase tracking-wide">
                        {m.label}
                      </p>
                      <p className="text-[9px] text-gray-400 font-medium">
                        {m.bank}
                      </p>
                    </div>
                    {method === m.id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
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
                className="w-full py-3 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lanjutkan →
              </button>
            </>
          )}

          {/* Step 2 — Instruksi */}
          {step === 2 && method && (
            <>
              <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase">
                Instruksi Pembayaran
              </p>
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-2.5">
                {instructions[method].map((ins, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-black text-blue-600">
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-700">{ins}</p>
                  </div>
                ))}
              </div>
              {method === "qris" && (
                <div className="flex justify-center">
                  <div className="w-32 h-32 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest text-center">
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
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 transition-all"
                >
                  ← Kembali
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  Sudah Bayar →
                </button>
              </div>
            </>
          )}

          {/* Step 3 — Upload bukti */}
          {step === 3 && (
            <>
              <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase">
                Upload Bukti Pembayaran
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all
                  ${file ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
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
                      {file.name}
                    </p>
                    <p className="text-[9px] text-blue-400 font-medium">
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
                    <p className="text-xs font-black text-gray-500 text-center">
                      Klik untuk upload bukti
                    </p>
                    <p className="text-[9px] text-gray-300 font-medium">
                      JPG, PNG, atau PDF • Maks. 5MB
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="text-[9px] font-black tracking-widest text-gray-400 uppercase block mb-1.5">
                  Catatan (opsional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Tambahkan catatan jika diperlukan..."
                  className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 transition-all"
                >
                  ← Kembali
                </button>
                <button
                  disabled={!file}
                  onClick={() => setStep(4)}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Kirim →
                </button>
              </div>
            </>
          )}

          {/* Step 4 — Sukses */}
          {step === 4 && (
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
                <p className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  Bukti Terkirim!
                </p>
                <p className="text-xs text-gray-400 font-medium mt-1">
                  Pendaftaran Anda sedang diverifikasi oleh admin. Anda akan
                  mendapat notifikasi setelah disetujui.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 w-full">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                  ⏳ Menunggu Verifikasi
                </p>
                <p className="text-[10px] text-amber-500 font-medium mt-1">
                  Proses verifikasi 1×24 jam kerja
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Submit Modal (Pra Asesmen & Tugas) ────────────────────────────────────────
function SubmitModal({ title, description, onClose }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef();

  const handleSubmit = () => {
    if (!file) return;
    setDone(true);
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all"
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
          <p className="text-[9px] font-black tracking-widest text-blue-400 uppercase mb-1">
            Pengumpulan
          </p>
          <h3 className="text-sm font-black text-white leading-snug pr-8">
            {title}
          </h3>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!done ? (
            <>
              {description && (
                <div className="bg-blue-50 rounded-2xl border border-blue-100 px-4 py-3">
                  <p className="text-[9px] font-black tracking-widest text-blue-400 uppercase mb-1">
                    Instruksi
                  </p>
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">
                    {description}
                  </p>
                </div>
              )}

              {/* Upload area */}
              <div>
                <label className="text-[9px] font-black tracking-widest text-gray-400 uppercase block mb-1.5">
                  File Jawaban *
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-2.5 cursor-pointer transition-all
                    ${file ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  {file ? (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
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
                        {file.name}
                      </p>
                      <p className="text-[9px] text-blue-400">
                        Klik untuk ganti
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-gray-400"
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
                        PDF, Excel, Word • Maks. 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[9px] font-black tracking-widest text-gray-400 uppercase block mb-1.5">
                  Catatan untuk Instruktur (opsional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Tulis catatan atau hal yang ingin disampaikan terkait jawaban Anda..."
                  className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 transition-all"
                >
                  Batal
                </button>
                <button
                  disabled={!file}
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Kumpulkan →
                </button>
              </div>
            </>
          ) : (
            <div className="py-4 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-green-500"
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
                <p className="text-sm font-black text-gray-900 uppercase">
                  Berhasil Dikumpulkan!
                </p>
                <p className="text-xs text-gray-400 font-medium mt-1">
                  Jawaban Anda telah diterima. Instruktur akan segera memeriksa.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inner Section (Pra Asesmen / Materi / Tugas) ──────────────────────────────
function InnerSection({ title, icon, children, accent = "blue" }) {
  const [open, setOpen] = useState(false);
  const accents = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-100",
      text: "text-blue-600",
      dot: "bg-blue-500",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-100",
      text: "text-green-600",
      dot: "bg-green-500",
    },
    violet: {
      bg: "bg-violet-50",
      border: "border-violet-100",
      text: "text-violet-600",
      dot: "bg-violet-500",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      text: "text-amber-600",
      dot: "bg-amber-500",
    },
  };
  const a = accents[accent];

  return (
    <div className={`rounded-xl border ${a.border} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${a.bg} transition-all`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
          <span
            className={`text-[10px] font-black tracking-widest uppercase ${a.text}`}
          >
            {title}
          </span>
          {icon}
        </div>
        <svg
          className={`w-3.5 h-3.5 ${a.text} transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && <div className="px-4 py-4 bg-white space-y-3">{children}</div>}
    </div>
  );
}

// ── Course Card (accordion) ────────────────────────────────────────────────────
function CourseCard({ course, isOpen, onToggle, onEnroll, onSubmit }) {
  const progressColor =
    course.progress === 100 ? "bg-green-500" : "bg-blue-600";

  return (
    <div
      className={`bg-white rounded-2xl border-2 shadow-sm transition-all duration-300
      ${isOpen ? "border-blue-500 shadow-blue-100" : "border-gray-100 hover:border-gray-200"}`}
    >
      {/* ── Card Header (always visible) ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-5 px-6 py-5 text-left"
      >
        {/* Thumbnail */}
        <div
          className={`w-14 h-14 rounded-2xl ${course.color} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}
        >
          {course.thumbnail}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-md">
              {course.category}
            </span>
            {course.enrolled && (
              <span className="text-[9px] font-black tracking-widest text-blue-600 uppercase bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                Terdaftar
              </span>
            )}
          </div>
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mt-1.5 leading-snug">
            {course.title}
          </h3>
          <p className="text-[10px] text-gray-400 font-medium mt-1 flex items-center gap-2">
            {course.instructor}
            <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
            {course.duration}
          </p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {course.enrolled ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs font-black text-gray-800">
                {course.progress}%
              </span>
              <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${progressColor}`}
                  style={{ width: `${course.progress}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-gray-400">
                {course.progress === 100 ? "Selesai" : "Berlangsung"}
              </span>
            </div>
          ) : (
            <span className="text-sm font-black text-blue-600">
              {course.price}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
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
        </div>
      </button>

      {/* ── Expanded Content ── */}
      {isOpen && (
        <div className="px-6 pb-6 space-y-3 border-t border-gray-100 pt-4">
          {/* Not enrolled CTA */}
          {!course.enrolled && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black text-blue-800 uppercase tracking-wide">
                  Belum Terdaftar
                </p>
                <p className="text-[10px] text-blue-500 font-medium mt-0.5">
                  Enroll sekarang untuk mengakses semua materi
                </p>
              </div>
              <button
                onClick={() => onEnroll(course)}
                className="px-5 py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 whitespace-nowrap flex-shrink-0"
              >
                Enroll Sekarang
              </button>
            </div>
          )}

          {/* Pra Asesmen */}
          {course.praAsesmen && (
            <InnerSection
              title="Pra Asesmen"
              accent="amber"
              icon={
                course.praAsesmen.submitted ? (
                  <span className="text-[9px] font-black text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md ml-1">
                    ✓ Dikumpulkan
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md ml-1">
                    Belum Dikumpulkan
                  </span>
                )
              }
            >
              <p className="text-xs text-gray-600 leading-relaxed">
                {course.praAsesmen.description}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={course.praAsesmen.fileUrl}
                  className="flex items-center gap-2 px-4 py-2 text-[9px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-all"
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Unduh Soal
                </a>
                {!course.praAsesmen.submitted && course.enrolled && (
                  <button
                    onClick={() =>
                      onSubmit(
                        "Pra Asesmen — " + course.title,
                        course.praAsesmen.description,
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 text-[9px] font-black tracking-widest uppercase bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-sm"
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
                    Kumpulkan
                  </button>
                )}
              </div>
            </InnerSection>
          )}

          {/* Materi */}
          <InnerSection title="Materi" accent="blue">
            {course.modules.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between gap-4 py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-blue-400"
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
                  <span className="text-xs font-bold text-gray-700 truncate">
                    {mod.title}
                  </span>
                </div>
                {course.enrolled ? (
                  <a
                    href={mod.fileUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest uppercase text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all flex-shrink-0"
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
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-black text-gray-300 uppercase tracking-widest">
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
            ))}
          </InnerSection>

          {/* Tugas */}
          <InnerSection title="Tugas" accent="violet">
            {course.tugas.map((task) => (
              <div
                key={task.id}
                className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-black text-gray-800 uppercase tracking-wide leading-snug">
                    {task.title}
                  </p>
                  {task.submitted ? (
                    <span className="text-[9px] font-black text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md flex-shrink-0">
                      ✓ Dikumpulkan
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md flex-shrink-0">
                      Belum
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {task.description}
                </p>
                <div className="flex items-center gap-3">
                  {task.fileUrl && (
                    <a
                      href={task.fileUrl}
                      className="inline-flex items-center gap-2 px-4 py-2 text-[9px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-all"
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Unduh Soal
                    </a>
                  )}
                  {!task.submitted && course.enrolled && (
                    <button
                      onClick={() => onSubmit(task.title, task.description)}
                      className="flex items-center gap-2 px-4 py-2 text-[9px] font-black tracking-widest uppercase bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-sm"
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
                      Kumpulkan Tugas
                    </button>
                  )}
                </div>
                {!course.enrolled && (
                  <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest flex items-center gap-1">
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
                    Enroll untuk akses
                  </p>
                )}
              </div>
            ))}
          </InnerSection>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StudentCourseList() {
  const [openId, setOpenId] = useState(null);
  const [enrollCourse, setEnrollCourse] = useState(null);
  const [submitModal, setSubmitModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  const filtered = coursesData.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "ALL" ||
      (filter === "ENROLLED" && c.enrolled) ||
      (filter === "AVAILABLE" && !c.enrolled);
    return matchSearch && matchFilter;
  });

  const totalEnrolled = coursesData.filter((c) => c.enrolled).length;
  const totalAvailable = coursesData.filter((c) => !c.enrolled).length;

  return (
    <>
      <MainLayout title="My Learning">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
              My Learning
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Akses semua kelas dan materi pembelajaran Anda.
            </p>
          </div>

          {/* Quick stats + filter tabs */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {[
                { key: "ALL", label: "Semua", count: coursesData.length },
                { key: "ENROLLED", label: "Terdaftar", count: totalEnrolled },
                { key: "AVAILABLE", label: "Tersedia", count: totalAvailable },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all
                  ${filter === tab.key ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"}`}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${filter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
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
                placeholder="Cari kelas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
              />
            </div>
          </div>

          {/* Course List */}
          <div className="flex flex-col gap-4">
            {filtered.length > 0 ? (
              filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isOpen={openId === course.id}
                  onToggle={() => toggle(course.id)}
                  onEnroll={setEnrollCourse}
                  onSubmit={(title, desc) =>
                    setSubmitModal({ title, description: desc })
                  }
                />
              ))
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center gap-3">
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                  Tidak ada kelas ditemukan
                </p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
      {/* Enroll / Payment Modal */}
      {enrollCourse && (
        <EnrollModal
          course={enrollCourse}
          onClose={() => setEnrollCourse(null)}
        />
      )}

      {/* Submit Modal */}
      {submitModal && (
        <SubmitModal
          title={submitModal.title}
          description={submitModal.description}
          onClose={() => setSubmitModal(null)}
        />
      )}
    </>
  );
}
