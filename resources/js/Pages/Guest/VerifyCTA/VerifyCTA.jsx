import { useState } from "react";
import GuestLayout from "@/Layouts/GuestLayout";

function VerifyCTA() {
  const [certId, setCertId] = useState("");
  const hasValue = certId.trim().length > 0;

  return (
    <GuestLayout>
      <section className="bg-gray-100 min-h-screen flex flex-col">
        {/* MAIN CONTENT */}
        <main className="flex-4 flex pt-23 justify-center px-6 py-4">
          <div className="flex flex-col items-center gap-7 max-w-lg w-full">
            {/* Shield Icon */}
            <div className="w-23 h-23 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
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

            <h1 className="text-4xl font-black text-black tracking-tight text-center">
              CERTIFICATE VERIFICATION
            </h1>

            <p className="text-sm text-gray-600 text-center leading-relaxed max-w-md">
              Verify the authenticity of professional certifications issued by
              the INKINDO Learning Center.
            </p>

            {/* Card */}
            <div className="bg-white rounded-2xl shadow-md p-8 w-full">
              <p className="text-xs font-bold tracking-widest text-black-400 mb-3 uppercase">
                Certificate ID Number
              </p>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  placeholder="e.g., INK-2024-001"
                  className="flex-1 border border-gray-200 bg-blue-50 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                />
                <button
                  disabled={!hasValue}
                  className={`px-5 py-3 rounded-xl text-xs font-extrabold tracking-widest uppercase whitespace-nowrap transition-all duration-300
                  ${
                    hasValue
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5 cursor-pointer"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  VERIFY NOW
                </button>
              </div>

              <p className="mt-4 text-center text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                Security Tip: Always check if the certificate ID matches the one
                printed on the physical document.
              </p>
            </div>
          </div>
        </main>
      </section>
    </GuestLayout>
  );
}

export default VerifyCTA;
