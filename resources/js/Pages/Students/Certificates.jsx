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

// ── Certificate Row ───────────────────────────────
function CertRow({ cert }) {
  const [hovered, setHovered] = useState(false);
  const config = statusConfig[cert.status] ?? statusConfig.active;

  return (
    <div
      className={`bg-card rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200 cursor-pointer
        ${hovered ? "border-primary/50 shadow-lg shadow-primary/20 -translate-y-0.5" : "border-border"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        {cert.evaluation && (
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-0.5">
            Nilai Akhir: {cert.evaluation.finalScore} &middot; Grade: {cert.evaluation.grade}
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

      {/* Download Certificate */}
      <a
        href={cert.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Download Certificate"
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
      </a>

      {/* Verify Button */}
      {cert.credentialId && (
        <a
          href={route("guest.verify.show", cert.credentialId)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 text-[10px] font-extrabold tracking-widest uppercase px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white transition-all duration-200"
        >
          Verify
        </a>
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
            filtered.map((cert) => <CertRow key={cert.id} cert={cert} />)
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
