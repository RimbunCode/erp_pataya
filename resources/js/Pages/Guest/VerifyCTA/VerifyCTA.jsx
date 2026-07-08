import { useState } from "react";
import { router } from "@inertiajs/react";
import GuestLayout from "@/Layouts/GuestLayout";
import { getGuestText } from "@/lib/guestPageContent";
import {
  LiveEditableText,
  useGuestLiveContent,
} from "../LiveEditor/GuestLiveEditorContext";

function VerifyForm({ content = {}, certId, setCertId, onSubmit }) {
  const hasValue = certId.trim().length > 0;
  const effectiveContent = useGuestLiveContent(content);

  const fieldLabel = getGuestText(
    effectiveContent,
    "verify.fieldLabel",
    "Certificate ID Number",
  );
  const placeholder = getGuestText(
    effectiveContent,
    "verify.placeholder",
    "e.g., INK-2024-001",
  );
  const buttonLabel = getGuestText(
    effectiveContent,
    "verify.buttonLabel",
    "VERIFY NOW",
  );
  const securityTip = getGuestText(
    effectiveContent,
    "verify.securityTip",
    "Security Tip: Always check if the certificate ID matches the one printed on the physical document.",
  );

  return (
    <div className="bg-card rounded-2xl shadow-md p-8 w-full">
      <LiveEditableText
        as="p"
        path="verify.fieldLabel"
        className="text-xs font-bold tracking-widest text-muted-foreground mb-3 uppercase whitespace-pre-line"
      >
        {fieldLabel}
      </LiveEditableText>

      <div className="flex gap-3">
        <input
          type="text"
          value={certId}
          onChange={(event) => setCertId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
          placeholder={placeholder}
          className="flex-1 border border-border bg-primary-soft rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent focus:bg-card transition-all"
        />
        <button
          type="button"
          disabled={!hasValue}
          onClick={onSubmit}
          className={`px-5 py-3 rounded-xl text-xs font-extrabold tracking-widest uppercase whitespace-nowrap transition-all duration-300
            ${
              hasValue
                ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-md shadow-primary/20 hover:-translate-y-0.5 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
        >
          <LiveEditableText as="span" path="verify.buttonLabel">
            {buttonLabel}
          </LiveEditableText>
        </button>
      </div>

      <LiveEditableText
        as="p"
        path="verify.securityTip"
        className="mt-4 text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase whitespace-pre-line"
      >
        {securityTip}
      </LiveEditableText>
    </div>
  );
}

function VerifyResultMessage({ heading, message }) {
  return (
    <div className="bg-card rounded-2xl shadow-md p-8 w-full text-center">
      <p className="text-lg font-bold text-foreground mb-2">{heading}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function VerifyIdentityCard({ result }) {
  return (
    <div className="bg-card rounded-2xl shadow-md p-6 w-full text-left">
      <p className="text-xs font-bold tracking-widest text-muted-foreground mb-3 uppercase">
        Sertifikat Valid
      </p>
      <dl className="space-y-2 text-sm text-foreground">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Nama Peserta</dt>
          <dd className="font-semibold text-right">{result.studentName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Pelatihan</dt>
          <dd className="font-semibold text-right">{result.courseTitle}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">No. Sertifikat</dt>
          <dd className="font-semibold text-right">{result.credentialId}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Tanggal Terbit</dt>
          <dd className="font-semibold text-right">{result.issuedDate}</dd>
        </div>
      </dl>
    </div>
  );
}

function VerifyCTAContent({ content = {}, credentialId = null, result = null }) {
  const [certId, setCertId] = useState(credentialId ?? "");
  const effectiveContent = useGuestLiveContent(content);

  const title = getGuestText(
    effectiveContent,
    "verify.title",
    "CERTIFICATE VERIFICATION",
  );
  const description = getGuestText(
    effectiveContent,
    "verify.description",
    "Verify the authenticity of professional certifications issued by the INKINDO Learning Center.",
  );

  const handleVerify = () => {
    if (certId.trim().length === 0) return;
    router.get(route("guest.verify.show", certId.trim()));
  };

  const showIframe = result?.found && result.status === "active" && result.pdfViewerUrl;

  return (
    <section className="bg-muted min-h-screen flex flex-col">
      <main className="flex-4 flex pt-23 justify-center px-6 py-4">
        <div className="flex flex-col items-center gap-7 max-w-lg w-full">
          <div className="w-23 h-23 bg-gradient-to-br from-primary to-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <svg
              className="w-18 h-18 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-black text-foreground tracking-tight text-center whitespace-pre-line">
            <LiveEditableText as="span" path="verify.title">
              {title}
            </LiveEditableText>
          </h1>

          <LiveEditableText
            as="p"
            path="verify.description"
            className="text-sm text-foreground text-center leading-relaxed max-w-md whitespace-pre-line"
          >
            {description}
          </LiveEditableText>

          <VerifyForm
            content={content}
            certId={certId}
            setCertId={setCertId}
            onSubmit={handleVerify}
          />

          {result && result.found === false && (
            <VerifyResultMessage
              heading="Tidak Ditemukan"
              message="Nomor sertifikat tidak ditemukan."
            />
          )}

          {result?.found && result.status === "revoked" && (
            <VerifyResultMessage
              heading="Sertifikat Dicabut"
              message="Sertifikat telah dicabut."
            />
          )}

          {result?.found && result.status === "expired" && (
            <VerifyResultMessage
              heading="Sertifikat Kedaluwarsa"
              message={`Sertifikat telah kedaluwarsa pada ${result.expiresDate}.`}
            />
          )}

          {result?.found && result.status === "active" && (
            <VerifyIdentityCard result={result} />
          )}
        </div>
      </main>

      {showIframe && (
        <iframe
          src={result.pdfViewerUrl}
          title="Certificate Preview"
          className="w-full h-screen border-0"
        />
      )}
    </section>
  );
}

export default function VerifyCTA({ content = {}, credentialId = null, result = null }) {
  return (
    <GuestLayout>
      <VerifyCTAContent content={content} credentialId={credentialId} result={result} />
    </GuestLayout>
  );
}
