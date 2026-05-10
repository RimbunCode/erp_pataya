import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const certificates = [
  {
    id: 1,
    title: "BIM Associate Certification",
    issuer: "INKINDO Learning Center",
    issuedDate: "12 Jan 2025",
    expiryDate: "12 Jan 2027",
    credentialId: "INK-2025-BIM-001",
    status: "active",
  },
  {
    id: 2,
    title: "AutoCAD Professional",
    issuer: "INKINDO Learning Center",
    issuedDate: "3 Mar 2025",
    expiryDate: "3 Mar 2027",
    credentialId: "INK-2025-CAD-002",
    status: "active",
  },
  {
    id: 3,
    title: "Safety Engineering Fundamentals",
    issuer: "INKINDO Learning Center",
    issuedDate: "20 Apr 2023",
    expiryDate: "20 Apr 2025",
    credentialId: "INK-2023-SAF-003",
    status: "expired",
  },
];

const statusConfig = {
  active: {
    label: "Active",
    color: "text-green-600",
    bg: "bg-green-50",
    dot: "bg-green-500",
  },
  expired: {
    label: "Expired",
    color: "text-red-400",
    bg: "bg-red-50",
    dot: "bg-red-400",
  },
};

// ── Add Certificate Modal ─────────────────────────
function AddCertificateModal({ onClose }) {
  const [form, setForm] = useState({
    title: "",
    issuer: "",
    credentialId: "",
    issuedDate: "",
    expiryDate: "",
  });

  const isComplete =
    form.title.trim() &&
    form.issuer.trim() &&
    form.credentialId.trim() &&
    form.issuedDate.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-300 hover:text-gray-500 transition-colors"
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

        <div className="flex items-center gap-3 mb-6">
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
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
              Add Certificate
            </h3>
            <p className="text-xs text-gray-400">
              Add an external certification to your profile.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              Certificate Title
            </label>
            <input
              type="text"
              placeholder="e.g. BIM Associate Certification"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              Issuing Organization
            </label>
            <input
              type="text"
              placeholder="e.g. INKINDO Learning Center"
              value={form.issuer}
              onChange={(e) =>
                setForm((p) => ({ ...p, issuer: e.target.value }))
              }
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              Credential ID
            </label>
            <input
              type="text"
              placeholder="e.g. INK-2025-BIM-001"
              value={form.credentialId}
              onChange={(e) =>
                setForm((p) => ({ ...p, credentialId: e.target.value }))
              }
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
                Issue Date
              </label>
              <input
                type="date"
                value={form.issuedDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, issuedDate: e.target.value }))
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
                Expiry Date{" "}
                <span className="normal-case text-gray-300">(optional)</span>
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, expiryDate: e.target.value }))
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!isComplete}
            className={`flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
              ${
                isComplete
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
          >
            Add Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Verify Modal ──────────────────────────────────
function VerifyModal({ cert, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | loading | success | failed

  const handleVerify = () => {
    setStatus("loading");
    setTimeout(() => {
      setStatus(cert.status === "active" ? "success" : "failed");
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-300 hover:text-gray-500 transition-colors"
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

        <div className="flex items-center gap-3 mb-6">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
              Verify Certificate
            </h3>
            <p className="text-xs text-gray-400">
              Check the authenticity of this certificate.
            </p>
          </div>
        </div>

        {/* Cert Info */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100">
          <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wide mb-3">
            {cert.title}
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                Issuer
              </span>
              <span className="text-[10px] font-bold text-gray-600">
                {cert.issuer}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                Credential ID
              </span>
              <span className="text-[10px] font-bold text-gray-600">
                {cert.credentialId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                Issued
              </span>
              <span className="text-[10px] font-bold text-gray-600">
                {cert.issuedDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                Expires
              </span>
              <span className="text-[10px] font-bold text-gray-600">
                {cert.expiryDate}
              </span>
            </div>
          </div>
        </div>

        {/* Result */}
        {status === "success" && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-5 py-4 mb-5">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-xs font-bold text-green-600">
              Certificate is valid and authentic.
            </p>
          </div>
        )}
        {status === "failed" && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 mb-5">
            <svg
              className="w-5 h-5 text-red-400 flex-shrink-0"
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
            <p className="text-xs font-bold text-red-500">
              Certificate could not be verified or has expired.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {status === "idle" && (
            <button
              onClick={handleVerify}
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              Verify Now
            </button>
          )}
          {status === "loading" && (
            <button
              disabled
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-blue-400 text-white cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Verifying...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Certificate Row ───────────────────────────────
function CertRow({ cert, onVerify }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = statusConfig[cert.status];

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200 cursor-pointer
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-lg shadow-gray-100"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
        <svg
          className="w-8 h-8 text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
          />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wide leading-tight">
          {cert.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">
          {cert.issuer}
          <span className="mx-2">·</span>
          Issued {cert.issuedDate}
        </p>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-0.5">
          ID: {cert.credentialId}
        </p>
      </div>

      {/* Expiry */}
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
          Expires
        </p>
        <p className="text-xs font-bold text-gray-600 mt-0.5">
          {cert.expiryDate}
        </p>
      </div>

      {/* Status */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0 ${config.bg}`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span
          className={`text-[10px] font-extrabold tracking-widest uppercase ${config.color}`}
        >
          {config.label}
        </span>
      </div>

      {/* Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 w-36">
            {["Download PDF", "Share", "Remove"].map((item) => (
              <button
                key={item}
                className={`w-full text-left px-4 py-2 text-xs font-semibold transition-colors hover:bg-gray-50
                  ${item === "Remove" ? "text-red-400 hover:text-red-500" : "text-gray-600"}`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Verify Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onVerify(cert);
        }}
        className="flex-shrink-0 text-[10px] font-extrabold tracking-widest uppercase px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200"
      >
        Verify
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────
export default function Certificates() {
  const [search, setSearch] = useState("");
  const [verifyTarget, setVerifyTarget] = useState(null);

  const filtered = certificates.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <MainLayout title="My Certificates" breadcrumb="Certificates">
      <div className="p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-700 uppercase tracking-tight">
              My Certificates
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Manage and verify your earned certifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search certificates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 text-xs bg-white border border-gray-350 rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-600"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex flex-col gap-4">
          {filtered.length > 0 ? (
            filtered.map((cert) => (
              <CertRow key={cert.id} cert={cert} onVerify={setVerifyTarget} />
            ))
          ) : (
            <div className="text-center py-20 text-gray-300">
              <p className="text-sm font-bold uppercase tracking-widest">
                No certificates found
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
