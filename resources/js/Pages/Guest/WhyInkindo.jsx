// ── Why Inkindo Section ───────────────────────────────────────────────────────
export function WhyInkindoSection() {
  const features = [
    {
      icon: (
        <svg
          className="w-6 h-6 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.177-.578-4.222-1.598-5.985M15 6.75a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      iconBg: "bg-blue-50",
      title: "OFFICIAL CERTIFICATION",
      desc: "Earn credentials that are recognized by all major construction companies and regulatory bodies in Indonesia.",
    },
    {
      icon: (
        <svg
          className="w-6 h-6 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
          />
        </svg>
      ),
      iconBg: "bg-indigo-50",
      title: "EXPERT INSTRUCTORS",
      desc: "Learn directly from industry veterans and certified BIM managers who are active in large-scale national projects.",
    },
    {
      icon: (
        <svg
          className="w-6 h-6 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
          />
        </svg>
      ),
      iconBg: "bg-green-50",
      title: "HYBRID EXPERIENCE",
      desc: "Flexible learning paths combining interactive online modules with hands-on offline workshops and site visits.",
    },
  ];

  return (
    <section className="bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight mb-3">
            WHY INKINDO LEARNING?
          </h2>
          <p className="text-gray-400 text-sm">
            We provide more than just courses. We provide a bridge to
            professional excellence.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 hover:border-blue-500 transition-all duration-300 flex flex-col"
            >
              {/* Icon box */}
              <div
                className={`w-14 h-14 ${f.iconBg} rounded-2xl flex items-center justify-center mb-6`}
              >
                {f.icon}
              </div>

              {/* Title */}
              <h3 className="font-black text-gray-900 text-sm tracking-wide mb-3">
                {f.title}
              </h3>

              {/* Description */}
              <p className="text-gray-400 text-xs leading-relaxed flex-1 mb-6">
                {f.desc}
              </p>

              {/* Learn More */}
              <a
                href="/about"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-gray-500 hover:text-blue-600 transition-colors group"
              >
                LEARN MORE
                <svg
                  className="w-3 h-3 group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
