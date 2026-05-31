import Link from "@/Components/Link";
import { usePage } from "@inertiajs/react";
import { getGuestLines, getGuestText } from "@/lib/guestPageContent";
import {
  LiveEditableText,
  useGuestLiveContent,
} from "./LiveEditor/GuestLiveEditorContext";

export function SiteFooter() {
  const { content = {} } = usePage().props;
  const effectiveContent = useGuestLiveContent(content);

  const brandTitle = getGuestText(
    effectiveContent,
    "footer.brand.title",
    "INKINDO",
  );
  const brandSubtitle = getGuestText(
    effectiveContent,
    "footer.brand.subtitle",
    "Learning Center",
  );
  const brandDescription = getGuestText(
    effectiveContent,
    "footer.brand.description",
    "Leading the digital transformation of professional training and certification for engineering and construction industries in Indonesia.",
  );

  const exploreTitle = getGuestText(
    effectiveContent,
    "footer.explore.title",
    "EXPLORE",
  );
  const exploreLinks = getGuestLines(effectiveContent, "footer.explore.links", [
    "BROWSE TRAININGS",
    "CERTIFICATION PATH",
    "OUR INSTRUCTORS",
    "AFFILIATE PROGRAM",
  ]);

  const companyTitle = getGuestText(
    effectiveContent,
    "footer.company.title",
    "COMPANY",
  );
  const companyLinks = getGuestLines(effectiveContent, "footer.company.links", [
    "ABOUT INKINDO",
    "CAREER OPPORTUNITIES",
    "PRIVACY POLICY",
    "TERMS OF SERVICE",
  ]);

  const contactTitle = getGuestText(
    effectiveContent,
    "footer.contact.title",
    "CONTACT US",
  );
  const contactAddress = getGuestText(
    effectiveContent,
    "footer.contact.address",
    "Jl. Bendungan Hilir No.29, Jakarta Pusat, DKI Jakarta 10210",
  );
  const contactPhone = getGuestText(
    effectiveContent,
    "footer.contact.phone",
    "+62 (21) 573-8603",
  );
  const contactEmail = getGuestText(
    effectiveContent,
    "footer.contact.email",
    "info@inkindo-learning.com",
  );

  const copyright = getGuestText(
    effectiveContent,
    "footer.bottom.copyright",
    "COPYRIGHT 2024 INKINDO LEARNING CENTER. ALL RIGHTS RESERVED.",
  );
  const helpCenter = getGuestText(
    effectiveContent,
    "footer.bottom.helpCenter",
    "HELP CENTER",
  );
  const sitemap = getGuestText(
    effectiveContent,
    "footer.bottom.sitemap",
    "SITEMAP",
  );
  return (
    <footer className="bg-[#0f1623] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
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
                <LiveEditableText
                  as="div"
                  path="footer.brand.title"
                  className="font-extrabold text-sm tracking-widest uppercase whitespace-pre-line"
                >
                  {brandTitle}
                </LiveEditableText>
                <LiveEditableText
                  as="div"
                  path="footer.brand.subtitle"
                  className="text-[9px] tracking-widest text-primary uppercase font-semibold whitespace-pre-line"
                >
                  {brandSubtitle}
                </LiveEditableText>
              </div>
            </div>
            <LiveEditableText
              as="p"
              path="footer.brand.description"
              className="text-muted-foreground text-xs leading-relaxed mb-6 max-w-[220px] whitespace-pre-line"
            >
              {brandDescription}
            </LiveEditableText>
            <div className="flex items-center gap-2">
              {[
                { label: "f", href: "#" },
                { label: "X", href: "#" },
                { label: "in", href: "#" },
                { label: "li", href: "#" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-8 h-8 rounded-full border border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary text-[10px] font-bold transition-colors"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <LiveEditableText
              as="p"
              path="footer.explore.title"
              className="text-[10px] font-bold tracking-widest uppercase text-primary mb-5 whitespace-pre-line"
            >
              {exploreTitle}
            </LiveEditableText>
            <ul className="space-y-3">
              {exploreLinks.map((linkLabel, index) => (
                <li key={`${linkLabel}-${index}`}>
                  <Link
                    href={route("guest.training")}
                    className="text-muted-foreground hover:text-white text-[11px] font-semibold tracking-widest uppercase transition-colors whitespace-pre-line"
                  >
                    <LiveEditableText
                      as="span"
                      path={`footer.explore.links.${index}`}
                    >
                      {linkLabel}
                    </LiveEditableText>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <LiveEditableText
              as="p"
              path="footer.company.title"
              className="text-[10px] font-bold tracking-widest uppercase text-primary mb-5 whitespace-pre-line"
            >
              {companyTitle}
            </LiveEditableText>
            <ul className="space-y-3">
              {companyLinks.map((linkLabel, index) => (
                <li key={`${linkLabel}-${index}`}>
                  <Link
                    href={route("guest.about")}
                    className="text-muted-foreground hover:text-white text-[11px] font-semibold tracking-widest uppercase transition-colors whitespace-pre-line"
                  >
                    <LiveEditableText
                      as="span"
                      path={`footer.company.links.${index}`}
                    >
                      {linkLabel}
                    </LiveEditableText>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <LiveEditableText
              as="p"
              path="footer.contact.title"
              className="text-[10px] font-bold tracking-widest uppercase text-primary mb-5 whitespace-pre-line"
            >
              {contactTitle}
            </LiveEditableText>
            <ul className="space-y-4">
              <LiveEditableText
                as="li"
                path="footer.contact.address"
                className="flex items-start gap-2 text-muted-foreground text-xs whitespace-pre-line"
              >
                <svg
                  className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                {contactAddress}
              </LiveEditableText>
              <LiveEditableText
                as="li"
                path="footer.contact.phone"
                className="flex items-center gap-2 text-muted-foreground text-xs whitespace-pre-line"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-primary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                {contactPhone}
              </LiveEditableText>
              <LiveEditableText
                as="li"
                path="footer.contact.email"
                className="flex items-center gap-2 text-muted-foreground text-xs whitespace-pre-line"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-primary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                {contactEmail}
              </LiveEditableText>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-muted-foreground tracking-widest uppercase">
          <LiveEditableText
            as="span"
            path="footer.bottom.copyright"
            className="whitespace-pre-line text-center sm:text-left"
          >
            {copyright}
          </LiveEditableText>
          <div className="flex gap-6">
            <Link
              href="#"
              className="hover:text-muted-foreground transition-colors whitespace-pre-line"
            >
              <LiveEditableText as="span" path="footer.bottom.helpCenter">
                {helpCenter}
              </LiveEditableText>
            </Link>
            <Link
              href="#"
              className="hover:text-muted-foreground transition-colors whitespace-pre-line"
            >
              <LiveEditableText as="span" path="footer.bottom.sitemap">
                {sitemap}
              </LiveEditableText>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
