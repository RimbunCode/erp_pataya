import { useState } from "react";
import { router } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";

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
  revoked: {
    label: "Revoked",
    color: "text-gray-400",
    bg: "bg-gray-100",
    dot: "bg-gray-400",
  },
};

// ── Verify Modal ──────────────────────────────────
function VerifyModal({ cert, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | loading | success | failed
  const [result, setResult] = useState(null);

  const handleVerify = async () => {
    setStatus("loading");
    try {
      const res = await fetch(
        route("student.certificates.verify", cert.credentialId),
      );
      const data = await res.json();
      setResult(data);
      setStatus(data.valid ? "success" : "failed");
    } catch {
      setStatus("failed");
      setResult(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-card rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-muted-foreground transition-colors"
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
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
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
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">
              Verify Certificate
            </h3>
            <p className="text-xs text-muted-foreground">
              Check the authenticity of this certificate.
            </p>
          </div>
        </div>

        {/* Cert Info */}
        <div className="bg-muted rounded-2xl p-5 mb-6 border border-border">
          <p className="text-xs font-extrabold text-foreground uppercase tracking-wide mb-3">
            {cert.title}
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Issuer
              </span>
              <span className="text-[10px] font-bold text-foreground">
                {cert.issuer}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Credential ID
              </span>
              <span className="text-[10px] font-bold text-foreground">
                {cert.credentialId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Issued
              </span>
              <span className="text-[10px] font-bold text-foreground">
                {cert.issuedDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Expires
              </span>
              <span className="text-[10px] font-bold text-foreground">
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
            className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-muted-foreground uppercase border border-border rounded-xl hover:bg-muted transition-colors"
          >
            Close
          </button>
          {status === "idle" && (
            <button
              onClick={handleVerify}
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
            >
              Verify Now
            </button>
          )}
          {status === "loading" && (
            <button
              disabled
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-primary text-white cursor-not-allowed flex items-center justify-center gap-2"
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
  const config = statusConfig[cert.status] ?? statusConfig.active;

  return (
    <div
      className={`bg-card rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200 cursor-pointer
        ${hovered ? "border-primary/50 shadow-lg shadow-primary/20 -translate-y-0.5" : "border-border"}`}
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
        <h3 className="text-sm font-black text-foreground uppercase tracking-wide leading-tight">
          {cert.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-1">
          {cert.issuer}
          <span className="mx-2">·</span>
          Issued {cert.issuedDate}
        </p>
        {cert.credentialId && (
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-0.5">
            ID: {cert.credentialId}
          </p>
        )}
      </div>

      {/* Expiry */}
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Expires
        </p>
        <p className="text-xs font-bold text-foreground mt-0.5">
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
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 bg-card border border-border rounded-xl shadow-lg py-1 z-10 w-36">
            <a
              href={cert.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted text-foreground block"
              onClick={(e) => e.stopPropagation()}
            >
              Download PDF
            </a>
            <a
              href={cert.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted text-foreground block"
              onClick={(e) => e.stopPropagation()}
            >
              View Certificate
            </a>
          </div>
        )}
      </div>

      {/* Verify Button */}
      {cert.credentialId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onVerify(cert);
          }}
          className="flex-shrink-0 text-[10px] font-extrabold tracking-widest uppercase px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white transition-all duration-200"
        >
          Verify
        </button>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-amber-300"
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
      <p className="text-sm font-black text-foreground uppercase tracking-widest">
        No Certificates Yet
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Complete a course to earn your first certificate.
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────
export default function Certificates({ certificates = [] }) {
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
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
              My Certificates
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
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
                className="pl-9 pr-4 py-2.5 text-xs bg-card border border-border rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder-muted-foreground"
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
            <EmptyState />
          )}
        </div>
      </div>

      {verifyTarget && (
        <VerifyModal
          cert={verifyTarget}
          onClose={() => setVerifyTarget(null)}
        />
      )}
    </MainLayout>
  );
}
