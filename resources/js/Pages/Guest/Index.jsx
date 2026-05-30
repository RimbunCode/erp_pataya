import GuestLayout from "@/Layouts/GuestLayout";
import Link from "@/Components/Link";
import { useEffect, useState } from "react";
import { PopularTrainingSection } from "./PopularTrainingSection";
import { CTABannerSection } from "./CTABannerSection";
import { WhyInkindoSection } from "./WhyInkindo";
import {
  getGuestImageUrl,
  getGuestLines,
  getGuestText,
} from "@/lib/guestPageContent";
import { getByPath } from "@/lib/guestContentDraft";
import {
  LiveEditableText,
  useGuestLiveContent,
} from "./LiveEditor/GuestLiveEditorContext";

function FadingCard({
  icon,
  title,
  subtitle,
  titlePath,
  subtitlePath,
  className,
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((value) => !value);
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`absolute bg-card rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 transition-opacity duration-700 ease-in-out ${className}`}
      style={{ opacity: visible ? 1 : 0.3 }}
    >
      <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0 text-white text-lg">
        {icon}
      </div>
      <div>
        <LiveEditableText
          as="p"
          path={subtitlePath}
          className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold whitespace-pre-line"
        >
          {subtitle}
        </LiveEditableText>
        <LiveEditableText
          as="p"
          path={titlePath}
          className="text-[11px] font-bold text-foreground tracking-wide uppercase whitespace-pre-line"
        >
          {title}
        </LiveEditableText>
      </div>
    </div>
  );
}

function BouncingCard({
  icon,
  title,
  subtitle,
  titlePath,
  subtitlePath,
  className,
}) {
  return (
    <>
      <style>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .bounce-card {
          animation: gentle-bounce 800ms ease-in-out infinite;
        }
      `}</style>
      <div
        className={`bounce-card absolute bg-card rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 ${className}`}
      >
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0 text-white text-lg">
          {icon}
        </div>
        <div>
          <LiveEditableText
            as="p"
            path={subtitlePath}
            className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold whitespace-pre-line"
          >
            {subtitle}
          </LiveEditableText>
          <LiveEditableText
            as="p"
            path={titlePath}
            className="text-[11px] font-bold text-foreground tracking-wide uppercase whitespace-pre-line"
          >
            {title}
          </LiveEditableText>
        </div>
      </div>
    </>
  );
}

function Badge({ icon, label, labelPath }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-primary/30 bg-card text-primary text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">
      <span>{icon}</span>
      <LiveEditableText
        as="span"
        path={labelPath}
        className="whitespace-pre-line"
      >
        {label}
      </LiveEditableText>
    </span>
  );
}

function Stars({ count = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, index) => (
        <svg
          key={index}
          className="w-4 h-4 text-yellow-400 fill-yellow-400"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function AvatarStack() {
  const colors = ["bg-primary", "bg-pink-400", "bg-green-400", "bg-orange-400"];
  const initials = ["AK", "BR", "CL", "DM"];

  return (
    <div className="flex -space-x-2">
      {colors.map((color, index) => (
        <div
          key={initials[index]}
          className={`w-8 h-8 rounded-full border-2 border-white ${color} flex items-center justify-center text-white text-[9px] font-bold`}
        >
          {initials[index]}
        </div>
      ))}
    </div>
  );
}

function HeroSection({ content }) {
  const badge = getGuestText(
    content,
    "home.hero.badge",
    "NEW: BIM CERTIFICATION 2024",
  );
  const title = getGuestText(
    content,
    "home.hero.title",
    "ENGINEER YOUR DIGITAL FUTURE",
  );
  const description = getGuestText(
    content,
    "home.hero.description",
    "The official Learning Management System of INKINDO. Advanced training, professional certifications, and a community of experts.",
  );
  const primaryCtaLabel = getGuestText(
    content,
    "home.hero.primaryCtaLabel",
    "START LEARNING",
  );
  const secondaryCtaLabel = getGuestText(
    content,
    "home.hero.secondaryCtaLabel",
    "HOW IT WORKS",
  );
  const statsLabel = getGuestText(
    content,
    "home.hero.statsLabel",
    "12K+ CERTIFIED MEMBERS",
  );
  const topCardTitle = getGuestText(
    content,
    "home.hero.topCardTitle",
    "INDUSTRY READY",
  );
  const topCardSubtitle = getGuestText(
    content,
    "home.hero.topCardSubtitle",
    "GLOBAL STANDARDS",
  );
  const bottomCardTitle = getGuestText(
    content,
    "home.hero.bottomCardTitle",
    "ISO CERTIFIED LMS",
  );
  const bottomCardSubtitle = getGuestText(
    content,
    "home.hero.bottomCardSubtitle",
    "VERIFIED PROGRAM",
  );
  const heroImageUrl = getGuestImageUrl(
    content,
    "home.media.heroImageFileId",
    "/storage/images/hero-bg.png",
  );

  return (
    <section className="relative bg-muted overflow-hidden pt-16 pb-20">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 flex flex-col gap-6 max-w-xl">
          <Badge icon="*" label={badge} labelPath="home.hero.badge" />

          <LiveEditableText
            as="h1"
            path="home.hero.title"
            className="text-5xl lg:text-6xl font-black leading-tight tracking-tight text-foreground whitespace-pre-line"
          >
            {title}
          </LiveEditableText>

          <LiveEditableText
            as="p"
            path="home.hero.description"
            className="text-muted-foreground text-base leading-relaxed max-w-md whitespace-pre-line"
          >
            {description}
          </LiveEditableText>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href={route("guest.training")}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold tracking-widest uppercase px-6 py-3.5 rounded-lg transition-colors"
            >
              <LiveEditableText as="span" path="home.hero.primaryCtaLabel">
                {primaryCtaLabel}
              </LiveEditableText>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <button className="inline-flex items-center gap-3 text-foreground hover:text-primary transition-colors group">
              <span className="w-10 h-10 rounded-full bg-card shadow border border-border flex items-center justify-center group-hover:shadow-md transition-shadow">
                <svg
                  className="w-4 h-4 text-primary ml-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <LiveEditableText
                as="span"
                path="home.hero.secondaryCtaLabel"
                className="text-xs font-bold tracking-widest uppercase whitespace-pre-line"
              >
                {secondaryCtaLabel}
              </LiveEditableText>
            </button>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <AvatarStack />
            <div>
              <Stars />
              <LiveEditableText
                as="p"
                path="home.hero.statsLabel"
                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-0.5 whitespace-pre-line"
              >
                {statsLabel}
              </LiveEditableText>
            </div>
          </div>
        </div>

        <div className="flex-1 relative flex justify-center items-center min-h-[420px]">
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={heroImageUrl}
              alt="Engineering visualization"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>

          <FadingCard
            icon={
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
                  d="M9 12.75L11.25 15 15 9.75M12 3l7.5 4.5v5.25c0 4.25-2.75 8-7.5 9.75-4.75-1.75-7.5-5.5-7.5-9.75V7.5L12 3z"
                />
              </svg>
            }
            title={topCardTitle}
            subtitle={topCardSubtitle}
            titlePath="home.hero.topCardTitle"
            subtitlePath="home.hero.topCardSubtitle"
            className="top-4 -right-4 lg:-right-8 z-10"
          />

          <BouncingCard
            icon={
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
                  d="M12 3l9 4.5v6c0 4.5-3 7.75-9 9.5-6-1.75-9-5-9-9.5v-6L12 3z"
                />
              </svg>
            }
            title={bottomCardTitle}
            subtitle={bottomCardSubtitle}
            titlePath="home.hero.bottomCardTitle"
            subtitlePath="home.hero.bottomCardSubtitle"
            className="bottom-8 left-0 lg:-left-4 z-10"
          />
        </div>
      </div>
    </section>
  );
}

function TrustedBy({ content }) {
  const heading = getGuestText(
    content,
    "home.trusted.heading",
    "TRUSTED BY INDUSTRY LEADERS",
  );
  const companies = getGuestLines(content, "home.trusted.companies", [
    "WIKA",
    "ADHI KARYA",
    "PP (PERSERO)",
    "HUTAMA KARYA",
    "WASZKITA",
  ]);
  const shouldSlide = companies.length > 6;
  const slidingCompanies = shouldSlide
    ? [...companies, ...companies]
    : companies;

  return (
    <section className="bg-card py-10 border-b border-border">
      <style>{`
        @keyframes trusted-slider {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .trusted-slider-track {
          width: max-content;
          animation: trusted-slider 28s linear infinite;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-6">
        <LiveEditableText
          as="p"
          path="home.trusted.heading"
          className="text-center text-[10px] tracking-[0.25em] text-muted-foreground uppercase font-semibold mb-6 whitespace-pre-line"
        >
          {heading}
        </LiveEditableText>

        {!shouldSlide && (
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-14">
            {companies.map((company, index) => (
              <LiveEditableText
                key={`${company}-${index}`}
                as="span"
                path={`home.trusted.companies.${index}`}
                className="text-muted-foreground font-black text-sm lg:text-base tracking-widest uppercase hover:text-muted-foreground transition-colors whitespace-pre-line"
              >
                {company}
              </LiveEditableText>
            ))}
          </div>
        )}

        {shouldSlide && (
          <div className="overflow-hidden border-y border-border py-4">
            <div className="trusted-slider-track flex items-center gap-10 lg:gap-16">
              {slidingCompanies.map((company, index) => (
                <LiveEditableText
                  key={`${company}-${index}`}
                  as="span"
                  path={`home.trusted.companies.${index % companies.length}`}
                  className="shrink-0 text-muted-foreground font-black text-sm lg:text-base tracking-widest uppercase whitespace-pre-line"
                >
                  {company}
                </LiveEditableText>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HomeAdsSection({ content }) {
  const adItems = getByPath(content, "home.ads.items");
  const ads = Array.isArray(adItems)
    ? adItems
        .map((adItem, index) => ({ adItem, index }))
        .filter(({ adItem }) => Boolean(adItem?.enabled))
    : [];

  if (ads.length === 0) {
    return null;
  }

  return (
    <section className="bg-background py-8 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="space-y-4">
          {ads.map(({ index }) => {
            const titlePath = `home.ads.items.${index}.title`;
            const descriptionPath = `home.ads.items.${index}.description`;
            const ctaPath = `home.ads.items.${index}.ctaLabel`;
            const urlPath = `home.ads.items.${index}.url`;
            const openInNewTabPath = `home.ads.items.${index}.openInNewTab`;
            const imagePath = `home.ads.items.${index}.imageFileId`;

            const title = getGuestText(
              content,
              titlePath,
              "TRAINING PARTNER PROMO",
            );
            const description = getGuestText(
              content,
              descriptionPath,
              "Promosikan program atau partner strategis di area home page.",
            );
            const ctaLabel = getGuestText(content, ctaPath, "LEARN MORE");
            const destinationUrl = getByPath(content, urlPath);
            const openInNewTab = Boolean(getByPath(content, openInNewTabPath));
            const imageUrl = getGuestImageUrl(
              content,
              imagePath,
              "/storage/images/hero-bg.png",
            );

            const linkHref =
              typeof destinationUrl === "string" && destinationUrl.trim() !== ""
                ? destinationUrl
                : null;

            return (
              <article
                key={`ad-slot-${index}`}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
              >
                <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] items-stretch">
                  <img
                    src={imageUrl}
                    alt={`Ad Slot ${index + 1}`}
                    className="w-full h-44 md:h-full object-cover"
                  />
                  <div className="p-5 space-y-3">
                    <LiveEditableText
                      as="h3"
                      path={titlePath}
                      className="text-lg font-black text-foreground tracking-tight whitespace-pre-line"
                    >
                      {title}
                    </LiveEditableText>
                    <LiveEditableText
                      as="p"
                      path={descriptionPath}
                      className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                    >
                      {description}
                    </LiveEditableText>

                    {linkHref ? (
                      <a
                        href={linkHref}
                        target={openInNewTab ? "_blank" : "_self"}
                        rel={openInNewTab ? "noreferrer noopener" : undefined}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold tracking-widest uppercase px-4 py-2.5 rounded-lg transition-colors"
                      >
                        <LiveEditableText as="span" path={ctaPath}>
                          {ctaLabel}
                        </LiveEditableText>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 bg-muted text-muted-foreground text-xs font-bold tracking-widest uppercase px-4 py-2.5 rounded-lg">
                        <LiveEditableText as="span" path={ctaPath}>
                          {ctaLabel}
                        </LiveEditableText>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomeSections({ content = {} }) {
  const effectiveContent = useGuestLiveContent(content);

  return (
    <>
      <HeroSection content={effectiveContent} />
      <TrustedBy content={effectiveContent} />
      <HomeAdsSection content={effectiveContent} />
      <PopularTrainingSection content={effectiveContent} />
      <WhyInkindoSection content={effectiveContent} />
      <CTABannerSection content={effectiveContent} />
    </>
  );
}

export default function GuestHome({ content = {} }) {
  return (
    <GuestLayout>
      <HomeSections content={content} />
    </GuestLayout>
  );
}
