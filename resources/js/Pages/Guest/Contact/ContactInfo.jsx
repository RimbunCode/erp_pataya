import { getByPath } from "@/lib/guestContentDraft";
import { getGuestText } from "@/lib/guestPageContent";
import {
  LiveEditableText,
  useGuestLiveContent,
} from "../LiveEditor/GuestLiveEditorContext";
import GuestLayout from "@/Layouts/GuestLayout";

const CONTACT_ICON_MAP = {
  address: (
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
  phone: (
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
  email: (
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
};

function ContactUsContent({ content = {} }) {
  const effectiveContent = useGuestLiveContent(content);

  const heroTitle = getGuestText(
    effectiveContent,
    "contact.hero.title",
    "Get In Touch",
  );
  const heroDescription = getGuestText(
    effectiveContent,
    "contact.hero.description",
    "Have questions about our certification programs or institutional partnerships? Our team is here to help.",
  );

  const contactItems = getByPath(effectiveContent, "contact.contactItems");
  const contactInfo = Array.isArray(contactItems)
    ? contactItems.map((item, index) => ({
        icon: CONTACT_ICON_MAP[item?.icon] ?? CONTACT_ICON_MAP.phone,
        label: getGuestText(
          effectiveContent,
          `contact.contactItems.${index}.label`,
          "LABEL",
        ),
        value: getGuestText(
          effectiveContent,
          `contact.contactItems.${index}.value`,
          "Value",
        ),
      }))
    : [0, 1, 2].map((index) => ({
        icon: CONTACT_ICON_MAP[
          index === 0 ? "address" : index === 1 ? "phone" : "email"
        ],
        label: getGuestText(
          effectiveContent,
          `contact.contactItems.${index}.label`,
          index === 0
            ? "OFFICE ADDRESS"
            : index === 1
              ? "PHONE NUMBER"
              : "EMAIL ADDRESS",
        ),
        value: getGuestText(
          effectiveContent,
          `contact.contactItems.${index}.value`,
          index === 0
            ? "Jl. Bendungan Hilir No.29,\nJakarta Pusat, DKI Jakarta 10210"
            : index === 1
              ? "+62 (21) 573-8603"
              : "info@inkindo-learning.com",
        ),
      }));

  const supportLabel = getGuestText(
    effectiveContent,
    "contact.support.label",
    "Global Support",
  );
  const supportDescription = getGuestText(
    effectiveContent,
    "contact.support.description",
    "Available Monday to Friday, 08:00 AM - 05:00 PM WIB",
  );

  const fullNameLabel = getGuestText(
    effectiveContent,
    "contact.form.fullNameLabel",
    "Full Name",
  );
  const fullNamePlaceholder = getGuestText(
    effectiveContent,
    "contact.form.fullNamePlaceholder",
    "John Doe",
  );
  const emailLabel = getGuestText(
    effectiveContent,
    "contact.form.emailLabel",
    "Email Address",
  );
  const emailPlaceholder = getGuestText(
    effectiveContent,
    "contact.form.emailPlaceholder",
    "john@example.com",
  );
  const subjectLabel = getGuestText(
    effectiveContent,
    "contact.form.subjectLabel",
    "Subject",
  );
  const subjectPlaceholder = getGuestText(
    effectiveContent,
    "contact.form.subjectPlaceholder",
    "Inquiry about BIM Certification",
  );
  const messageLabel = getGuestText(
    effectiveContent,
    "contact.form.messageLabel",
    "Message",
  );
  const messagePlaceholder = getGuestText(
    effectiveContent,
    "contact.form.messagePlaceholder",
    "Tell us more about your needs...",
  );
  const submitLabel = getGuestText(
    effectiveContent,
    "contact.form.submitLabel",
    "SEND MESSAGE",
  );

  return (
    <div className="bg-card min-h-screen">
      <section className="bg-primary px-6 pt-20 pb-32 text-center">
        <LiveEditableText
          as="h1"
          path="contact.hero.title"
          className="text-5xl md:text-6xl font-black text-primary-foreground tracking-tight uppercase whitespace-pre-line"
        >
          {heroTitle}
        </LiveEditableText>
        <LiveEditableText
          as="p"
          path="contact.hero.description"
          className="mt-5 text-primary-soft text-sm md:text-base leading-relaxed max-w-lg mx-auto whitespace-pre-line"
        >
          {heroDescription}
        </LiveEditableText>
      </section>

      <section className="max-w-5xl mx-auto px-6 -mt-16 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          <div className="md:col-span-2 pt-20 flex flex-col gap-8">
            {contactInfo.map((contactItem, index) => (
              <div
                key={`${contactItem.label}-${index}`}
                className="flex items-start gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                  {contactItem.icon}
                </div>
                <div>
                  <LiveEditableText
                    as="p"
                    path={`contact.contactItems.${index}.label`}
                    className="text-[10px] font-bold tracking-[2px] text-primary uppercase mb-1 whitespace-pre-line"
                  >
                    {contactItem.label}
                  </LiveEditableText>
                  <LiveEditableText
                    as="p"
                    path={`contact.contactItems.${index}.value`}
                    className="text-sm font-black text-foreground leading-snug whitespace-pre-line"
                  >
                    {contactItem.value}
                  </LiveEditableText>
                </div>
              </div>
            ))}

            <hr className="border-border mt-2" />

            <div>
              <LiveEditableText
                as="p"
                path="contact.support.label"
                className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-2 whitespace-pre-line"
              >
                {supportLabel}
              </LiveEditableText>
              <LiveEditableText
                as="p"
                path="contact.support.description"
                className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
              >
                {supportDescription}
              </LiveEditableText>
            </div>
          </div>

          <div className="md:col-span-3 bg-card rounded-3xl shadow-xl border border-border p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              <div>
                <LiveEditableText
                  as="label"
                  path="contact.form.fullNameLabel"
                  className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2 whitespace-pre-line"
                >
                  {fullNameLabel}
                </LiveEditableText>
                <input
                  type="text"
                  placeholder={fullNamePlaceholder}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                />
              </div>
              <div>
                <LiveEditableText
                  as="label"
                  path="contact.form.emailLabel"
                  className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2 whitespace-pre-line"
                >
                  {emailLabel}
                </LiveEditableText>
                <input
                  type="email"
                  placeholder={emailPlaceholder}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2">
                  Phone or WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="+62 812 3456 7890"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                />
              </div>
              <div>
                <LiveEditableText
                  as="label"
                  path="contact.form.subjectLabel"
                  className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2 whitespace-pre-line"
                >
                  {subjectLabel}
                </LiveEditableText>
                <input
                  type="text"
                  placeholder={subjectPlaceholder}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
                />
              </div>
            </div>

            <div className="mb-7">
              <LiveEditableText
                as="label"
                path="contact.form.messageLabel"
                className="block text-[10px] font-bold tracking-[2px] text-primary uppercase mb-2 whitespace-pre-line"
              >
                {messageLabel}
              </LiveEditableText>
              <textarea
                rows={5}
                placeholder={messagePlaceholder}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all resize-none"
              />
            </div>

            <button className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-0.5 shadow-md shadow-primary/20 whitespace-pre-line">
              <LiveEditableText as="span" path="contact.form.submitLabel">
                {submitLabel}
              </LiveEditableText>
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
  );
}

export default function ContactUs({ content = {} }) {
  return (
    <GuestLayout>
      <ContactUsContent content={content} />
    </GuestLayout>
  );
}
