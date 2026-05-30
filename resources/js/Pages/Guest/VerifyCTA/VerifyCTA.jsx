import { useState } from "react";
import GuestLayout from "@/Layouts/GuestLayout";
import { getGuestText } from "@/lib/guestPageContent";
import {
  LiveEditableText,
  useGuestLiveContent,
} from "../LiveEditor/GuestLiveEditorContext";

function VerifyCTAContent({ content = {} }) {
  const [certId, setCertId] = useState("");
  const hasValue = certId.trim().length > 0;
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
    <section className="bg-muted min-h-screen flex flex-col">
      <main className="flex-4 flex pt-23 justify-center px-6 py-4">
        <div className="flex flex-col items-center gap-7 max-w-lg w-full">
          <div className="w-23 h-23 bg-gradient-to-br from-primary to-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <svg
              className="w-18 h-18 text-white"
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

          <h1 className="text-4xl font-black text-black tracking-tight text-center whitespace-pre-line">
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

          <div className="bg-card rounded-2xl shadow-md p-8 w-full">
            <LiveEditableText
              as="p"
              path="verify.fieldLabel"
              className="text-xs font-bold tracking-widest text-black-400 mb-3 uppercase whitespace-pre-line"
            >
              {fieldLabel}
            </LiveEditableText>

            <div className="flex gap-3">
              <input
                type="text"
                value={certId}
                onChange={(event) => setCertId(event.target.value)}
                placeholder={placeholder}
                className="flex-1 border border-border bg-primary-soft rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent focus:bg-card transition-all"
              />
              <button
                disabled={!hasValue}
                className={`px-5 py-3 rounded-xl text-xs font-extrabold tracking-widest uppercase whitespace-nowrap transition-all duration-300
                  ${
                    hasValue
                      ? "bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/20 hover:-translate-y-0.5 cursor-pointer"
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
        </div>
      </main>
    </section>
  );
}

export default function VerifyCTA({ content = {} }) {
  return (
    <GuestLayout>
      <VerifyCTAContent content={content} />
    </GuestLayout>
  );
}
