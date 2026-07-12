import type {
  DesignTemplate,
  LandingSection,
  Palette,
  PalettePreset,
  ProjectMeta,
  Typography,
} from "../types";

export const defaultPalette: Palette = {
  background: "#F7F1E8",
  surface: "#FFFFFF",
  text: "#1F2A24",
  muted: "#6B766D",
  accent: "#0F766E",
  accentContrast: "#FFFFFF",
  border: "#D8CFC2",
};

export const palettePresets: PalettePreset[] = [
  {
    id: "studio",
    name: "Studio",
    palette: defaultPalette,
  },
  {
    id: "citrus",
    name: "Citrus",
    palette: {
      background: "#FFF8E8",
      surface: "#FFFFFF",
      text: "#2A2118",
      muted: "#806F5A",
      accent: "#D9480F",
      accentContrast: "#FFFFFF",
      border: "#E8D7AE",
    },
  },
  {
    id: "mono",
    name: "Mono",
    palette: {
      background: "#F4F5F6",
      surface: "#FFFFFF",
      text: "#111827",
      muted: "#667085",
      accent: "#3D5A80",
      accentContrast: "#FFFFFF",
      border: "#D0D5DD",
    },
  },
];

export const defaultTypography: Typography = {
  fontPairing: "atelier",
  scale: "standard",
};

export const defaultProjectMeta: ProjectMeta = {
  name: "Field & Fern",
  audience: "urban home gardeners",
  goal: "Collect early interest for a spring launch",
  tone: "warm",
  shareSlug: "field-fern-preview",
};

export const defaultSections: LandingSection[] = [
  {
    id: "hero",
    kind: "hero",
    eyebrow: "New season preview",
    title: "Grow a calmer home, one plant at a time",
    body: "Field & Fern pairs resilient houseplants with simple care rituals for busy city homes.",
    visible: true,
  },
  {
    id: "features",
    kind: "features",
    eyebrow: "Why it works",
    title: "Plant care that fits into real life",
    body: "Guided watering cards, hardy starter bundles, and text reminders keep the routine light.",
    visible: true,
  },
  {
    id: "social-proof",
    kind: "socialProof",
    eyebrow: "Loved by early testers",
    title: "Designed for people who have killed a plant before",
    body: "The beta group reported fewer skipped watering days and more confidence choosing new plants.",
    visible: true,
  },
  {
    id: "pricing",
    kind: "pricing",
    eyebrow: "Starter bundle",
    title: "$42 for the first month",
    body: "Includes two low-maintenance plants, ceramic labels, a care guide, and seasonal swaps.",
    visible: true,
  },
  {
    id: "footer",
    kind: "footer",
    eyebrow: "Stay in the loop",
    title: "Join the spring waitlist",
    body: "Members get first access to bundle drops, care notes, and neighborhood pickup dates.",
    visible: true,
  },
];

export const designTemplates: DesignTemplate[] = [
  {
    id: "botanical-waitlist",
    name: "Botanical waitlist",
    description: "Soft launch page for a warm consumer brand.",
    palette: defaultPalette,
    typography: defaultTypography,
    heroLayout: "split",
    sections: defaultSections,
    metaPatch: {
      audience: "urban home gardeners",
      goal: "Collect early interest for a spring launch",
      tone: "warm",
    },
  },
  {
    id: "saas-launch",
    name: "SaaS launch",
    description: "Focused product page with sharper contrast and direct copy.",
    palette: {
      background: "#F6F8FB",
      surface: "#FFFFFF",
      text: "#14213D",
      muted: "#5C667A",
      accent: "#2563EB",
      accentContrast: "#FFFFFF",
      border: "#D9E2F2",
    },
    typography: {
      fontPairing: "modern",
      scale: "compact",
    },
    heroLayout: "centered",
    sections: [
      {
        id: "hero",
        kind: "hero",
        eyebrow: "Private beta",
        title: "Ship launch pages without losing the thread",
        body: "A lightweight workspace for teams turning positioning, copy, and mockups into one working page.",
        visible: true,
      },
      {
        id: "features",
        kind: "features",
        eyebrow: "Built for momentum",
        title: "From strategy to page state in one pass",
        body: "Capture audience, sections, visual tokens, and export-ready direction before handoff.",
        visible: true,
      },
      {
        id: "social-proof",
        kind: "socialProof",
        eyebrow: "Pilot signal",
        title: "Three teams replaced their launch-doc sprawl",
        body: "Every pilot shipped a shareable direction in under a day, with fewer review loops.",
        visible: true,
      },
      {
        id: "pricing",
        kind: "pricing",
        eyebrow: "Preview access",
        title: "$19 per seat in beta",
        body: "Invite collaborators, keep one active workspace, and export polished previews.",
        visible: true,
      },
      {
        id: "footer",
        kind: "footer",
        eyebrow: "Start lean",
        title: "Request a workspace invite",
        body: "Tell us your launch date and we will send a setup link.",
        visible: true,
      },
    ],
    metaPatch: {
      audience: "product marketers",
      goal: "Convert teams into beta requests",
      tone: "direct",
    },
  },
  {
    id: "atelier-drop",
    name: "Atelier drop",
    description: "Premium editorial landing page for a limited collection.",
    palette: {
      background: "#11100E",
      surface: "#1C1915",
      text: "#F8F0E5",
      muted: "#BDAF9A",
      accent: "#C9A45A",
      accentContrast: "#11100E",
      border: "#3A3328",
    },
    typography: {
      fontPairing: "editorial",
      scale: "expressive",
    },
    heroLayout: "stacked",
    sections: [
      {
        id: "hero",
        kind: "hero",
        eyebrow: "Limited release",
        title: "A quieter collection for late summer rooms",
        body: "Hand-finished vessels, linen shades, and low forms built around warm evening light.",
        visible: true,
      },
      {
        id: "features",
        kind: "features",
        eyebrow: "Materials",
        title: "Small-batch pieces with visible craft",
        body: "Stoneware, brass, and washed linen come together in a restrained palette.",
        visible: true,
      },
      {
        id: "social-proof",
        kind: "socialProof",
        eyebrow: "Collector note",
        title: "Each run is numbered and signed",
        body: "Collectors receive provenance cards and early access to future seasonal drops.",
        visible: true,
      },
      {
        id: "pricing",
        kind: "pricing",
        eyebrow: "Collection sets",
        title: "Sets begin at $280",
        body: "Reserve a three-piece grouping or join the first-look appointment list.",
        visible: true,
      },
      {
        id: "footer",
        kind: "footer",
        eyebrow: "Private viewing",
        title: "Book the studio preview",
        body: "Choose an appointment window before public release opens.",
        visible: true,
      },
    ],
    metaPatch: {
      audience: "design collectors",
      goal: "Book private viewing appointments",
      tone: "premium",
    },
  },
];
