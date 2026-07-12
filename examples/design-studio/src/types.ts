export type PaletteToken =
  "background" | "surface" | "text" | "muted" | "accent" | "accentContrast" | "border";

export type Palette = Record<PaletteToken, string>;

export type PalettePresetId = "studio" | "citrus" | "mono";

export interface PalettePreset {
  id: PalettePresetId;
  name: string;
  palette: Palette;
}

export type FontPairing = "atelier" | "editorial" | "modern";

export type TypeScale = "compact" | "standard" | "expressive";

export interface Typography {
  fontPairing: FontPairing;
  scale: TypeScale;
}

export type HeroLayout = "split" | "centered" | "stacked";

export type SectionKind = "hero" | "features" | "socialProof" | "pricing" | "footer";

export interface LandingSection {
  id: string;
  kind: SectionKind;
  eyebrow: string;
  title: string;
  body: string;
  visible: boolean;
}

export interface ProjectMeta {
  name: string;
  audience: string;
  goal: string;
  tone: "warm" | "direct" | "premium";
  shareSlug: string;
}

export interface ExportQuota {
  limit: number;
  remaining: number;
  lastExportedAt: string | null;
  message: string;
}

export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  palette: Palette;
  typography: Typography;
  heroLayout: HeroLayout;
  sections: LandingSection[];
  metaPatch: Pick<ProjectMeta, "audience" | "goal" | "tone">;
}

export interface DesignState {
  palette: Palette;
  typography: Typography;
  heroLayout: HeroLayout;
  sections: LandingSection[];
  templates: DesignTemplate[];
  activeTemplateId: string;
  projectMeta: ProjectMeta;
  exportQuota: ExportQuota;
  shareMessage: string;
}
