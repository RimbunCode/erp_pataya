import GuestLayout from "@/Layouts/GuestLayout";
import { getByPath } from "@/lib/guestContentDraft";
import { getGuestLines, getGuestText } from "@/lib/guestPageContent";
import {
  LiveEditableText,
  useGuestLiveContent,
} from "../LiveEditor/GuestLiveEditorContext";
import TiptapHtmlRenderer from "@/Components/TiptapHtmlRenderer";

const STAT_STYLES = [
  {
    accent: "from-amber-400/20 to-amber-600/10 border-amber-400/20",
    iconBg: "bg-amber-400/20 text-amber-300",
    numColor: "text-amber-300",
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
  },
  {
    accent: "from-primary/20 to-primary/10 border-primary/20",
    iconBg: "bg-primary/20 text-primary-soft-foreground",
    numColor: "text-primary-soft-foreground",
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
  },
  {
    accent: "from-purple-400/20 to-purple-600/10 border-purple-400/20",
    iconBg: "bg-purple-400/20 text-purple-300",
    numColor: "text-purple-300",
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
  },
  {
    accent: "from-teal-400/20 to-teal-600/10 border-teal-400/20",
    iconBg: "bg-teal-400/20 text-teal-300",
    numColor: "text-teal-300",
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
  },
];

function AboutUsContent({ content = {} }) {
  const effectiveContent = useGuestLiveContent(content);

  const heroTitle = getGuestText(
    effectiveContent,
    "about.hero.title",
    "Empowering Engineers Since 1970",
  );
  const heroDescription = getGuestText(
    effectiveContent,
    "about.hero.description",
    "INKINDO (Ikatan Nasional Konsultan Indonesia) Learning Center is a hub for engineering excellence and professional development in Indonesia.",
  );

  const statsArray = getByPath(effectiveContent, "about.stats");
  const stats = Array.isArray(statsArray)
    ? statsArray.map((stat, index) => ({
        value: getGuestText(effectiveContent, `about.stats.${index}.value`, "100+"),
        label: getGuestText(effectiveContent, `about.stats.${index}.label`, "Label"),
      }))
    : [0, 1, 2, 3].map((index) => ({
        value: getGuestText(
          effectiveContent,
          `about.stats.${index}.value`,
          index === 0 ? "54+" : index === 1 ? "12K+" : index === 2 ? "450+" : "34",
        ),
        label: getGuestText(
          effectiveContent,
          `about.stats.${index}.label`,
          index === 0
            ? "Years of Excellence"
            : index === 1
              ? "Certified Professionals"
              : index === 2
                ? "Expert Instructors"
                : "Regional Chapters",
        ),
      }));

  const shouldSlide = stats.length > 4;

  const visionTitle = getGuestText(
    effectiveContent,
    "about.vision.title",
    "Our Vision",
  );
  const visionDescription = getGuestText(
    effectiveContent,
    "about.vision.description",
    "Menjunjung tinggi kehormatan, kemuliaan dan nama baik profesi konsultan dalam hubungan kerja dengan pemberi tugas, sesama rekan konsultan dan masyarakat.",
  );

  const missionTitle = getGuestText(
    effectiveContent,
    "about.mission.title",
    "Our Mission",
  );
  const missionItems = getGuestLines(effectiveContent, "about.mission.items", [
    "Inkindo Jatim sebagai learning organisation yang dinamis dan adaptif terhadap perubahan peradaban.",
    "Inkindo Jatim sebagai wadah komunikasi anggota dan salah satu pusat environment jasa konstruksi khususnya di Jawa Timur.",
    "Penegakan norma, etika dan aturan organisasi.",
    "Menjunjung dan menjaga marwah organisasi.",
    "Mendorong dan menjaga iklim usaha jasa konsultan yang kondusif.",
    "Mendorong inovasi yang bermanfaat bagi masyarakat, berwawasan lingkungan serta berkelanjutan.",
    "Mendorong anggota dalam adaptasi terhadap perubahan peradaban melalui transformasi digital.",
    "Mitra strategis bagi pemerintah, dunia usaha atau mitra kerja, dunia akademik serta masyarakat.",
  ]);

  return (
    <div className="bg-background min-h-screen">
      <section className="relative bg-primary px-6 pt-32 pb-16">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center mb-16">
          <LiveEditableText
            as="h1"
            path="about.hero.title"
            className="text-5xl md:text-6xl font-black text-primary-foreground tracking-tight leading-tight uppercase whitespace-pre-line"
          >
            {heroTitle}
          </LiveEditableText>
          <LiveEditableText
            as="p"
            path="about.hero.description"
            className="mt-6 text-sm md:text-base text-primary-foreground/80 leading-relaxed max-w-xl mx-auto whitespace-pre-line"
          >
            {heroDescription}
          </LiveEditableText>
        </div>

        {shouldSlide ? (
          <div className="relative z-10 max-w-5xl mx-auto overflow-hidden">
            <style>{`
              @keyframes stats-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .stats-scroll-track {
                width: max-content;
                animation: stats-scroll 25s linear infinite;
              }
            `}</style>
            <div className="stats-scroll-track flex items-center gap-4">
              {[...stats, ...stats].map((stat, index) => {
                const style = STAT_STYLES[index % STAT_STYLES.length];
                const realIndex = index % stats.length;

                return (
                  <div
                    key={`stat-${index}`}
                    className={`shrink-0 bg-gradient-to-br ${style.accent} border rounded-2xl px-6 py-8 flex flex-col items-center gap-3 text-center w-48`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.iconBg}`}>{style.icon}</div>
                    <LiveEditableText
                      as="div"
                      path={`about.stats.${realIndex}.value`}
                      className={`text-4xl font-black tracking-tight leading-none ${style.numColor} whitespace-pre-line`}
                    >
                      {stat.value}
                    </LiveEditableText>
                    <LiveEditableText
                      as="div"
                      path={`about.stats.${realIndex}.label`}
                      className="text-[10px] font-bold tracking-[2px] text-primary-foreground/60 uppercase whitespace-pre-line"
                    >
                      {stat.label}
                    </LiveEditableText>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const style = STAT_STYLES[index % STAT_STYLES.length];

              return (
                <div
                  key={`stat-${index}`}
                  className={`bg-gradient-to-br ${style.accent} border rounded-2xl px-6 py-8 flex flex-col items-center gap-3 text-center`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.iconBg}`}>{style.icon}</div>
                  <LiveEditableText
                    as="div"
                    path={`about.stats.${index}.value`}
                    className={`text-4xl font-black tracking-tight leading-none ${style.numColor} whitespace-pre-line`}
                  >
                    {stat.value}
                  </LiveEditableText>
                  <LiveEditableText
                    as="div"
                    path={`about.stats.${index}.label`}
                    className="text-[10px] font-bold tracking-[2px] text-white/40 uppercase whitespace-pre-line"
                  >
                    {stat.label}
                  </LiveEditableText>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="py-24 px-6">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="group bg-card rounded-3xl p-10 border border-primary/20 shadow-sm border-b-4 border-b-blue-500 hover:bg-muted hover:shadow-md transition-all duration-300">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-primary-foreground"
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
            <LiveEditableText
              as="h2"
              path="about.vision.title"
              className="text-2xl font-black text-foreground uppercase tracking-wide mb-5 whitespace-pre-line"
            >
              {visionTitle}
            </LiveEditableText>
            <LiveEditableText
              as="p"
              path="about.vision.description"
              className="text-sm text-foreground leading-relaxed whitespace-pre-line"
            >
              {visionDescription}
            </LiveEditableText>
          </div>

          <div className="group bg-card rounded-3xl p-11 border border-border shadow-sm border-b-4 border-b-purple-500 hover:bg-muted hover:shadow-md transition-all duration-300">
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
            <LiveEditableText
              as="h2"
              path="about.mission.title"
              className="text-2xl font-black text-foreground uppercase tracking-wide mb-5 whitespace-pre-line"
            >
              {missionTitle}
            </LiveEditableText>
            <ul className="space-y-4">
              {missionItems.map((item, index) => (
                <li key={`${index}-${item}`} className="flex items-start gap-3">
                  <span className="text-primary font-black text-xl leading-tight mt-0.5">
                    &gt;
                  </span>
                  <LiveEditableText
                    as="span"
                    path={`about.mission.items.${index}`}
                    className="text-sm font-semibold text-foreground leading-snug whitespace-pre-line"
                  >
                    {item}
                  </LiveEditableText>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Custom Sections */}
      {(() => {
        const customSections = getByPath(effectiveContent, "about.customSections");
        if (!Array.isArray(customSections) || customSections.length === 0) return null;

        return customSections
          .filter((section) => section?.enabled)
          .map((section, index) => {
            const sectionTagline = getByPath(effectiveContent, `about.customSections.${index}.tagline`);
            const sectionContent = getByPath(effectiveContent, `about.customSections.${index}.content`);
            return (
              <section key={`custom-${index}`} className="py-16 px-6 bg-card border-b border-border">
                <div className="max-w-5xl mx-auto">
                  <h2 className="text-3xl font-black text-foreground uppercase tracking-wide mb-2">
                    {section.title || "Custom Section"}
                  </h2>
                  <TiptapHtmlRenderer
                    doc={sectionTagline}
                    className="text-lg text-muted-foreground mb-6"
                  />
                  <TiptapHtmlRenderer
                    doc={sectionContent}
                    className="text-foreground leading-relaxed"
                  />
                </div>
              </section>
            );
          });
      })()}
    </div>
  );
}

export default function AboutUs({ content = {} }) {
  return (
    <GuestLayout>
      <AboutUsContent content={content} />
    </GuestLayout>
  );
}
