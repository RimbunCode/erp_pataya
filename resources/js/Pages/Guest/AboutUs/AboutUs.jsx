import GuestLayout from "@/Layouts/GuestLayout";

export default function AboutUs() {
  const stats = [
    { num: "54+", label: "Years of Excellence" },
    { num: "12K+", label: "Certified Professionals" },
    { num: "450+", label: "Expert Instructors" },
    { num: "34", label: "Regional Chapters" },
  ];

  const missions = [
    "1. Inkindo Jatim sebagai learning organisation yang dinamis dan adaptif terhadap perubahan peradaban.",
    "2. Inkindo Jatim sebgai wadah komunikasi anggota dan salah satu pusat environment jasa konstruksi khususnya di Jawa Timur.",
    "3. Penegakan norma, etika dan aturan organisasi.",
    "4. Menjunjung dan menjaga marwah organisasi.",
    "5. Mendorong dan menjaga iklim usaha jasa konsultan yang kondusif.",
    "6. Mendorong inovasi yang bermanfaat bagi masyarakat, berwawasan lingkungan serta berkelanjutan.",
    "7. Mendorong anggota dalam adaptasi terhadap perubahan peradaban melalui transformasi digital.",
    "8. Mitra strategis bagi pemerintah, dunia usaha atau mitra kerja, dunia akademik serta masyarakat.",
  ];

  return (
    <GuestLayout>
      <div className="bg-muted min-h-screen">
        {/* ── Hero + Stats ── */}
        <section
          className="relative px-6 pt-32 pb-16"
          style={{
            background: "linear-gradient(135deg, #0a0f2e 60%, #1a2a6c 100%)",
          }}
        >
          {/* diagonal slice overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(120deg, transparent 55%, #1e3a8a 55%)",
              opacity: 0.4,
            }}
          />

          {/* Hero text */}
          <div className="relative z-10 max-w-3xl mx-auto text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-tight uppercase">
              Empowering Engineers
              <br />
              Since 1970
            </h1>
            <p className="mt-6 text-sm md:text-base text-white leading-relaxed max-w-xl mx-auto">
              INKINDO (Ikatan Nasional Konsultan Indonesia) Learning Center is
              the premier hub for engineering excellence and professional
              development in Indonesia.
            </p>
          </div>

          {/* Stats */}
          <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                num: "54+",
                label: "Years of Excellence",
                icon: (
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
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                ),
                accent: "from-amber-400/20 to-amber-600/10 border-amber-400/20",
                iconBg: "bg-amber-400/20 text-amber-300",
                numColor: "text-amber-300",
              },
              {
                num: "12K+",
                label: "Certified Professionals",
                icon: (
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                    />
                  </svg>
                ),
                accent: "from-primary/20 to-primary/10 border-primary/20",
                iconBg: "bg-primary/20 text-primary-soft",
                numColor: "text-primary-soft",
              },
              {
                num: "450+",
                label: "Expert Instructors",
                icon: (
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
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                ),
                accent:
                  "from-purple-400/20 to-purple-600/10 border-purple-400/20",
                iconBg: "bg-purple-400/20 text-purple-300",
                numColor: "text-purple-300",
              },
              {
                num: "34",
                label: "Regional Chapters",
                icon: (
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ),
                accent: "from-teal-400/20 to-teal-600/10 border-teal-400/20",
                iconBg: "bg-teal-400/20 text-teal-300",
                numColor: "text-teal-300",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`bg-gradient-to-br ${s.accent} border rounded-2xl px-6 py-8 flex flex-col items-center gap-3 text-center`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconBg}`}
                >
                  {s.icon}
                </div>
                <div
                  className={`text-4xl font-black tracking-tight leading-none ${s.numColor}`}
                >
                  {s.num}
                </div>
                <div className="text-[10px] font-bold tracking-[2px] text-white/40 uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Vision & Mission ── */}
        <section className="py-24 px-6">
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Vision */}
            <div className="group bg-card rounded-3xl p-10 border border-primary/20 shadow-sm border-b-4 border-b-blue-500 hover:bg-muted hover:shadow-md transition-all duration-300">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-6">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-foreground uppercase tracking-wide mb-5">
                Our Vision
              </h2>
              <p className="text-sm text-black leading-relaxed">
                Menjunjung tinggi kehormatan, kemuliaan dan nama baik profesi
                konsultan dalam hubungan kerja dengan pemberi tugas, sesama
                rekan konsultan dan masyarakat.
              </p>
            </div>

            {/* Mission */}
            <div className="group bg-card rounded-3xl p-11 border border-purple-100 shadow-sm border-b-4 border-b-purple-500 hover:bg-muted hover:shadow-md transition-all duration-300">
              <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-foreground uppercase tracking-wide mb-5">
                Our Mission
              </h2>
              <ul className="space-y-4">
                {missions.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="text-primary font-black text-xl leading-tight mt-0.5">
                      ›
                    </span>
                    <span className="text-sm font-semibold text-foreground leading-snug">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </GuestLayout>
  );
}
