import { formatRp } from "../Utils/formatRp";
import { useState, useRef } from "react";

export default function CheckoutModal({ items, total, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [showCheckout, setShowCheckout] = useState(false);
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
      "Masukkan nomor VA dan konfirmasi",
      "Simpan bukti transfer",
    ],
    tf: [
      `Transfer ke: BRI 0123-01-234567-56-8 a.n. INKINDO`,
      `Nominal tepat: ${formatRp(total)}`,
      "Berita: Nama Lengkap + INKINDO",
      "Simpan bukti transfer",
    ],
    qris: [
      `Scan QR Code di bawah ini`,
      `Masukkan nominal: ${formatRp(total)}`,
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
            Checkout — {items.length} Class
          </p>
          <p className="text-xl font-black text-white">{formatRp(total)}</p>

          {/* Steps */}
          <div className="flex items-center gap-2 mt-4">
            {["Methods", "Instructions", "Upload"].map((s, i) => (
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
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Step 1 */}
          {step === 1 && (
            <>
              {/* Order mini summary */}
              <div className="bg-muted rounded-2xl border border-border p-4 space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[10px] font-bold text-foreground truncate flex-1 pr-4">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-black text-foreground flex-shrink-0">
                      {formatRp(item.price)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Total
                  </span>
                  <span className="text-sm font-black text-primary">
                    {formatRp(total)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                Choose Your Payment Method
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
                Continue
              </button>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && method && (
            <>
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                Payment Instruction
              </p>
              <div className="bg-muted rounded-2xl border border-border p-4 space-y-2.5">
                {instructions[method].map((ins, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-black text-primary">
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground">{ins}</p>
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
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-border transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
                >
                  Paid
                </button>
              </div>
            </>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <>
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                Upload Payment Proof
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
                      Change File
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
                      Upload Payment Proof
                    </p>
                    <p className="text-[9px] text-muted-foreground font-medium">
                      JPG, PNG, or PDF • Max. 5MB
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1.5">
                  Note (Optional)
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
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-border transition-all"
                >
                  Back
                </button>
                <button
                  disabled={!file}
                  onClick={onSuccess}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
