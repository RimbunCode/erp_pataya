import Link from "@/Components/Link";
import { getGuestText } from "@/lib/guestPageContent";
import { LiveEditableText } from "./LiveEditor/GuestLiveEditorContext";

export function CTABannerSection({ content = {} }) {
  const heading = getGuestText(
    content,
    "home.ctaBanner.heading",
    "READY TO START YOUR JOURNEY?",
  );
  const description = getGuestText(
    content,
    "home.ctaBanner.description",
    "Join over 12,000 engineers who have leveled up their careers through our platform.",
  );
  const primaryCta = getGuestText(
    content,
    "home.ctaBanner.primaryCta",
    "GET STARTED NOW",
  );
  const secondaryCta = getGuestText(
    content,
    "home.ctaBanner.secondaryCta",
    "CONTACT US",
  );

  return (
    <section className="bg-background py-10 px-6">
      <div className="max-w-5xl mx-auto bg-primary rounded-3xl px-8 py-16 text-center shadow-xl shadow-primary/20">
        <LiveEditableText
          as="h2"
          path="home.ctaBanner.heading"
          className="text-4xl lg:text-5xl font-black text-primary-foreground tracking-tight leading-tight mb-4 whitespace-pre-line"
        >
          {heading}
        </LiveEditableText>
        <LiveEditableText
          as="p"
          path="home.ctaBanner.description"
          className="text-primary-soft text-sm leading-relaxed mb-10 max-w-lg mx-auto whitespace-pre-line"
        >
          {description}
        </LiveEditableText>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-card text-foreground hover:bg-primary-soft hover:text-primary-soft-foreground text-xs font-black tracking-widest uppercase px-8 py-4 rounded-xl transition-colors min-w-[180px] text-center"
          >
            <LiveEditableText as="span" path="home.ctaBanner.primaryCta">
              {primaryCta}
            </LiveEditableText>
          </Link>
          <Link
            href={route("guest.contact")}
            className="border-2 border-primary-foreground text-primary-foreground hover:bg-card hover:text-primary text-xs font-black tracking-widest uppercase px-8 py-4 rounded-xl transition-colors min-w-[180px] text-center"
          >
            <LiveEditableText as="span" path="home.ctaBanner.secondaryCta">
              {secondaryCta}
            </LiveEditableText>
          </Link>
        </div>
      </div>
    </section>
  );
}
