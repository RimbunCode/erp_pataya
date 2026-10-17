import TemplateAvatar from "./TemplateAvatar";
import TemplateBadge from "./TemplateBadge";
import TemplateChips from "./TemplateChips";
import TemplateDot from "./TemplateDot";
import TemplateIcon from "./TemplateIcon";
import {
  TemplateInline,
  TemplateMark,
  TemplateMuted,
  TemplateStack,
} from "./TemplateLayout";
import TemplateNavLink from "./TemplateNavLink";
import TemplateProgress from "./TemplateProgress";
import TemplateStatus from "./TemplateStatus";
import TemplateTruncate from "./TemplateTruncate";
import TemplateWhen from "./TemplateWhen";

/** Atribut template -> prop komponen (selain `class` -> `className`). */
export const TAG_ATTRS = [
  "color",
  "to",
  "of",
  "max",
  "value",
  "shape",
  "name",
  "src",
  "field",
];

/** Tag yang menerima `row`/`column` (butuh data baris). */
const DATA_TAGS = new Set(["badge", "nav-link", "chips", "when"]);

let registry = null;

/**
 * Peta nama tag -> komponen. Dibangun saat pertama dipakai (bukan saat modul
 * dievaluasi) karena TemplateChips <-> SemanticTemplate saling mengimpor.
 * @returns {Record<string, import("react").ElementType>}
 */
function buildRegistry() {
  return {
    muted: TemplateMuted,
    stack: TemplateStack,
    inline: TemplateInline,
    badge: TemplateBadge,
    status: TemplateStatus,
    dot: TemplateDot,
    "nav-link": TemplateNavLink,
    chips: TemplateChips,
    truncate: TemplateTruncate,
    progress: TemplateProgress,
    icon: TemplateIcon,
    avatar: TemplateAvatar,
    when: TemplateWhen,
    mark: TemplateMark,
  };
}

/**
 * Komponen untuk tag semantik, atau `undefined` bila bukan tag semantik.
 * @param {string} name
 * @returns {import("react").ElementType|undefined}
 */
export function getTagComponent(name) {
  registry ??= buildRegistry();

  return Object.hasOwn(registry, name) ? registry[name] : undefined;
}

/**
 * Apakah komponen tag butuh `row`/`column` sebagai prop.
 * @param {string} name
 * @returns {boolean}
 */
export function tagNeedsData(name) {
  return DATA_TAGS.has(name);
}
