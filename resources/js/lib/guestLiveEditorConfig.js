export const GUEST_THEME_COLOR_FIELDS = [
  { label: "Primary", path: "theme.guest.primary" },
  { label: "Primary Hover", path: "theme.guest.primaryHover" },
  { label: "Primary Soft", path: "theme.guest.primarySoft" },
  {
    label: "Primary Soft Foreground",
    path: "theme.guest.primarySoftForeground",
  },
  { label: "Foreground", path: "theme.guest.foreground" },
  { label: "Muted Foreground", path: "theme.guest.mutedForeground" },
  { label: "Background", path: "theme.guest.background" },
  { label: "Card", path: "theme.guest.card" },
];

const SHARED_FOOTER_SECTION = {
  title: "Footer",
  fields: [
    { label: "Brand Title", path: "footer.brand.title" },
    { label: "Brand Subtitle", path: "footer.brand.subtitle" },
    { label: "Brand Description", path: "footer.brand.description" },
    { label: "Explore Title", path: "footer.explore.title" },
    { label: "Explore Link 1", path: "footer.explore.links.0" },
    { label: "Explore Link 2", path: "footer.explore.links.1" },
    { label: "Explore Link 3", path: "footer.explore.links.2" },
    { label: "Explore Link 4", path: "footer.explore.links.3" },
    { label: "Company Title", path: "footer.company.title" },
    { label: "Company Link 1", path: "footer.company.links.0" },
    { label: "Company Link 2", path: "footer.company.links.1" },
    { label: "Company Link 3", path: "footer.company.links.2" },
    { label: "Company Link 4", path: "footer.company.links.3" },
    { label: "Contact Title", path: "footer.contact.title" },
    { label: "Contact Address", path: "footer.contact.address" },
    { label: "Contact Phone", path: "footer.contact.phone" },
    { label: "Contact Email", path: "footer.contact.email" },
    { label: "Bottom Copyright", path: "footer.bottom.copyright" },
    { label: "Bottom Help Center", path: "footer.bottom.helpCenter" },
    { label: "Bottom Sitemap", path: "footer.bottom.sitemap" },
  ],
};

const PAGE_FIELDS = {
  home: [
    {
      title: "Hero",
      fields: [
        { label: "Badge", path: "home.hero.badge" },
        { label: "Title", path: "home.hero.title" },
        { label: "Description", path: "home.hero.description" },
        { label: "Primary CTA", path: "home.hero.primaryCtaLabel" },
        { label: "Secondary CTA", path: "home.hero.secondaryCtaLabel" },
        { label: "Stats Label", path: "home.hero.statsLabel" },
        { label: "Top Card Title", path: "home.hero.topCardTitle" },
        { label: "Top Card Subtitle", path: "home.hero.topCardSubtitle" },
        { label: "Bottom Card Title", path: "home.hero.bottomCardTitle" },
        { label: "Bottom Card Subtitle", path: "home.hero.bottomCardSubtitle" },
      ],
    },
    {
      title: "Trusted",
      fields: [{ label: "Heading", path: "home.trusted.heading" }],
    },
    {
      title: "Popular",
      fields: [
        { label: "Heading", path: "home.popular.heading" },
        { label: "Description", path: "home.popular.description" },
      ],
    },
    {
      title: "Why Inkindo",
      fields: [
        { label: "Heading", path: "home.why.heading" },
        { label: "Description", path: "home.why.description" },
        { label: "Feature 1 Title", path: "home.why.features.0.title" },
        {
          label: "Feature 1 Description",
          path: "home.why.features.0.description",
        },
        {
          label: "Feature 1 Link Label",
          path: "home.why.features.0.linkLabel",
        },
        { label: "Feature 2 Title", path: "home.why.features.1.title" },
        {
          label: "Feature 2 Description",
          path: "home.why.features.1.description",
        },
        {
          label: "Feature 2 Link Label",
          path: "home.why.features.1.linkLabel",
        },
        { label: "Feature 3 Title", path: "home.why.features.2.title" },
        {
          label: "Feature 3 Description",
          path: "home.why.features.2.description",
        },
        {
          label: "Feature 3 Link Label",
          path: "home.why.features.2.linkLabel",
        },
      ],
    },
    {
      title: "CTA Banner",
      fields: [
        { label: "Heading", path: "home.ctaBanner.heading" },
        { label: "Description", path: "home.ctaBanner.description" },
        { label: "Primary CTA", path: "home.ctaBanner.primaryCta" },
        { label: "Secondary CTA", path: "home.ctaBanner.secondaryCta" },
      ],
    },
  ],
  about: [
    {
      title: "Hero",
      fields: [
        { label: "Title", path: "about.hero.title" },
        { label: "Description", path: "about.hero.description" },
      ],
    },
    {
      title: "Stats",
      fields: [
        { label: "Stat 1 Value", path: "about.stats.0.value" },
        { label: "Stat 1 Label", path: "about.stats.0.label" },
        { label: "Stat 2 Value", path: "about.stats.1.value" },
        { label: "Stat 2 Label", path: "about.stats.1.label" },
        { label: "Stat 3 Value", path: "about.stats.2.value" },
        { label: "Stat 3 Label", path: "about.stats.2.label" },
        { label: "Stat 4 Value", path: "about.stats.3.value" },
        { label: "Stat 4 Label", path: "about.stats.3.label" },
      ],
    },
    {
      title: "Vision",
      fields: [
        { label: "Title", path: "about.vision.title" },
        { label: "Description", path: "about.vision.description" },
      ],
    },
    {
      title: "Mission",
      fields: [
        { label: "Title", path: "about.mission.title" },
        { label: "Mission 1", path: "about.mission.items.0" },
        { label: "Mission 2", path: "about.mission.items.1" },
        { label: "Mission 3", path: "about.mission.items.2" },
        { label: "Mission 4", path: "about.mission.items.3" },
        { label: "Mission 5", path: "about.mission.items.4" },
        { label: "Mission 6", path: "about.mission.items.5" },
        { label: "Mission 7", path: "about.mission.items.6" },
        { label: "Mission 8", path: "about.mission.items.7" },
      ],
    },
  ],
  verify: [
    {
      title: "Verify",
      fields: [
        { label: "Title", path: "verify.title" },
        { label: "Description", path: "verify.description" },
        { label: "Field Label", path: "verify.fieldLabel" },
        { label: "Placeholder", path: "verify.placeholder" },
        { label: "Button Label", path: "verify.buttonLabel" },
        { label: "Security Tip", path: "verify.securityTip" },
      ],
    },
  ],
  contact: [
    {
      title: "Hero",
      fields: [
        { label: "Title", path: "contact.hero.title" },
        { label: "Description", path: "contact.hero.description" },
      ],
    },
    {
      title: "Contact Info",
      fields: [
        { label: "Address Label", path: "contact.contactItems.0.label" },
        { label: "Address Value", path: "contact.contactItems.0.value" },
        { label: "Phone Label", path: "contact.contactItems.1.label" },
        { label: "Phone Value", path: "contact.contactItems.1.value" },
        { label: "Email Label", path: "contact.contactItems.2.label" },
        { label: "Email Value", path: "contact.contactItems.2.value" },
        { label: "Support Label", path: "contact.support.label" },
        { label: "Support Description", path: "contact.support.description" },
      ],
    },
    {
      title: "Form",
      fields: [
        { label: "Full Name Label", path: "contact.form.fullNameLabel" },
        {
          label: "Full Name Placeholder",
          path: "contact.form.fullNamePlaceholder",
        },
        { label: "Email Label", path: "contact.form.emailLabel" },
        { label: "Email Placeholder", path: "contact.form.emailPlaceholder" },
        { label: "Subject Label", path: "contact.form.subjectLabel" },
        {
          label: "Subject Placeholder",
          path: "contact.form.subjectPlaceholder",
        },
        { label: "Message Label", path: "contact.form.messageLabel" },
        {
          label: "Message Placeholder",
          path: "contact.form.messagePlaceholder",
        },
        { label: "Submit Label", path: "contact.form.submitLabel" },
      ],
    },
  ],
};

export const HOME_IMAGE_FIELDS = [
  { label: "Hero Image", path: "home.media.heroImageFileId" },
  {
    label: "Popular Card Image 1",
    path: "home.media.popularCardImageFileIds.0",
  },
  {
    label: "Popular Card Image 2",
    path: "home.media.popularCardImageFileIds.1",
  },
  {
    label: "Popular Card Image 3",
    path: "home.media.popularCardImageFileIds.2",
  },
];

export const HOME_ADS_PATH = "home.ads.items";
export const HOME_TRUSTED_COMPANIES_PATH = "home.trusted.companies";

export function getLiveEditorSections(pageKey) {
  const pageSections = PAGE_FIELDS[pageKey] ?? [];

  return [...pageSections, SHARED_FOOTER_SECTION];
}
