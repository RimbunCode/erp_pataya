import Link from "@/Components/Link";

// ── Footer ────────────────────────────────────────────────────────────────────
export function SiteFooter() {
  return (
    <footer className="bg-[#0f1623] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                </svg>
              </div>
              <div>
                <div className="font-extrabold text-sm tracking-widest uppercase">
                  INKINDO
                </div>
                <div className="text-[9px] tracking-widest text-blue-400 uppercase font-semibold">
                  Learning Center
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed mb-6 max-w-[220px]">
              Leading the digital transformation of professional training and
              certification for engineering and construction industries in
              Indonesia.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-2">
              {[
                { label: "f", href: "#" },
                { label: "𝕏", href: "#" },
                { label: "in", href: "#" },
                { label: "li", href: "#" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="w-8 h-8 rounded-full border border-gray-700 hover:border-blue-500 flex items-center justify-center text-gray-400 hover:text-blue-400 text-[10px] font-bold transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400 mb-5">
              EXPLORE
            </p>
            <ul className="space-y-3">
              {[
                "BROWSE TRAININGS",
                "CERTIFICATION PATH",
                "OUR INSTRUCTORS",
                "AFFILIATE PROGRAM",
              ].map((l) => (
                <li key={l}>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white text-[11px] font-semibold tracking-widest uppercase transition-colors"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400 mb-5">
              COMPANY
            </p>
            <ul className="space-y-3">
              {[
                "ABOUT INKINDO",
                "CAREER OPPORTUNITIES",
                "PRIVACY POLICY",
                "TERMS OF SERVICE",
              ].map((l) => (
                <li key={l}>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white text-[11px] font-semibold tracking-widest uppercase transition-colors"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400 mb-5">
              CONTACT US
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-2 text-gray-400 text-xs">
                <svg
                  className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                Jl. Bendungan Hilir No.29, Jakarta Pusat, DKI Jakarta 10210
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-xs">
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                +62 (21) 573-8603
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-xs">
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                info@inkindo-learning.com
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-gray-500 tracking-widest uppercase">
          <span>© 2024 INKINDO LEARNING CENTER. ALL RIGHTS RESERVED.</span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-gray-300 transition-colors">
              HELP CENTER
            </Link>
            <Link href="#" className="hover:text-gray-300 transition-colors">
              SITEMAP
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
