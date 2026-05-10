import GuestLayout from "@/Layouts/GuestLayout";

export default function ContactUs() {
  const contactInfo = [
    {
      icon: (
        <svg
          className="w-5 h-5 text-primary"
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
      label: "OFFICE ADDRESS",
      value: "Jl. Bendungan Hilir No.29,\nJakarta Pusat, DKI Jakarta 10210",
    },
    {
      icon: (
        <svg
          className="w-5 h-5 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      ),
      label: "PHONE NUMBER",
      className: "text-primary",
      value: "+62 (21) 573-8603",
    },
    {
      icon: (
        <svg
          className="w-5 h-5 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
      label: "EMAIL ADDRESS",
      value: "info@inkindo-learning.com",
    },
  ];

  return (
    <GuestLayout>
      <div className="bg-card min-h-screen">
        {/* ── Hero ── */}
        <section className="bg-primary px-6 pt-20 pb-32 text-center">
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight uppercase">
            Get In Touch
          </h1>
          <p className="mt-5 text-primary-soft text-sm md:text-base leading-relaxed max-w-lg mx-auto">
            Have questions about our certification programs or institutional
            partnerships? Our team is here to help.
          </p>
        </section>

        {/* ── Content ── */}
        <section className="max-w-5xl mx-auto px-6 -mt-16 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
            {/* Left — Contact Info */}
            <div className="md:col-span-2 pt-20 flex flex-col gap-8">
              {contactInfo.map((c) => (
                <div key={c.label} className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                    {c.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[2px] text-primary uppercase mb-1">
                      {c.label}
                    </p>
                    <p className="text-sm font-black text-foreground leading-snug whitespace-pre-line">
                      {c.value}
                    </p>
                  </div>
                </div>
              ))}

              <hr className="border-border mt-2" />

              <div>
                <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                  Global Support
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Available Monday to Friday,
                  <br />
                  08:00 AM – 05:00 PM WIB
                </p>
              </div>
            </div>

            {/* Right — Form Card */}
            <div className="md:col-span-3 bg-card rounded-3xl shadow-xl border border-border p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-black-800 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Inquiry about BIM Certification"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-black-800 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                />
              </div>

              <div className="mb-7">
                <label className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2">
                  Message
                </label>
                <textarea
                  rows={5}
                  placeholder="Tell us more about your needs..."
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-black-800 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all resize-none"
                />
              </div>

              <button className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-0.5 shadow-md shadow-primary/20">
                Send Message
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
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </GuestLayout>
  );
}
