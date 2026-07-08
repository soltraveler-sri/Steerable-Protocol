import { palettePresets } from "../data/designData";
import { LandingPreview } from "../components/LandingPreview";
import { useDesignStudio } from "../state/designStore";
import type { FontPairing, HeroLayout, PaletteToken, TypeScale } from "../types";

const paletteLabels: Array<{ token: PaletteToken; label: string }> = [
  { token: "background", label: "Background" },
  { token: "surface", label: "Surface" },
  { token: "text", label: "Text" },
  { token: "muted", label: "Muted" },
  { token: "accent", label: "Accent" },
  { token: "accentContrast", label: "Accent text" },
  { token: "border", label: "Border" },
];

const fontPairings: Array<{ value: FontPairing; label: string }> = [
  { value: "atelier", label: "Atelier" },
  { value: "editorial", label: "Editorial" },
  { value: "modern", label: "Modern" },
];

const typeScales: Array<{ value: TypeScale; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "expressive", label: "Expressive" },
];

const heroLayouts: Array<{ value: HeroLayout; label: string }> = [
  { value: "split", label: "Split" },
  { value: "centered", label: "Centered" },
  { value: "stacked", label: "Stacked" },
];

export function Editor() {
  const { state, setters } = useDesignStudio();

  return (
    <div className="editor-grid">
      <section className="control-panel" aria-label="Editor controls">
        <div className="panel-header">
          <p className="eyebrow">Editor</p>
          <h2>Brand kit and page shape</h2>
        </div>

        <section className="control-section">
          <div className="section-heading">
            <h3>Palette</h3>
            <div className="preset-row">
              {palettePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="chip-button"
                  onClick={() => setters.applyPalettePreset(preset.id)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          <div className="palette-grid">
            {paletteLabels.map((item) => (
              <label key={item.token} className="color-control">
                <span>{item.label}</span>
                <input
                  type="color"
                  value={state.palette[item.token]}
                  onChange={(event) => setters.setPaletteToken(item.token, event.target.value)}
                />
                <input
                  type="text"
                  value={state.palette[item.token]}
                  onChange={(event) => setters.setPaletteToken(item.token, event.target.value)}
                  aria-label={`${item.label} hex value`}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="control-section">
          <h3>Typography</h3>
          <div className="segmented" aria-label="Font pairing">
            {fontPairings.map((item) => (
              <button
                key={item.value}
                type="button"
                className={state.typography.fontPairing === item.value ? "selected" : ""}
                onClick={() => setters.setFontPairing(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="segmented" aria-label="Type scale">
            {typeScales.map((item) => (
              <button
                key={item.value}
                type="button"
                className={state.typography.scale === item.value ? "selected" : ""}
                onClick={() => setters.setTypeScale(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="control-section">
          <h3>Hero Layout</h3>
          <div className="segmented" aria-label="Hero layout">
            {heroLayouts.map((item) => (
              <button
                key={item.value}
                type="button"
                className={state.heroLayout === item.value ? "selected" : ""}
                onClick={() => setters.setHeroLayout(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="control-section">
          <h3>Sections</h3>
          <div className="section-list">
            {state.sections.map((section, index) => (
              <article key={section.id} className="section-editor">
                <div className="section-toolbar">
                  <label>
                    <input
                      type="checkbox"
                      checked={section.visible}
                      onChange={() => setters.toggleSectionVisibility(section.id)}
                    />
                    <span>{section.kind}</span>
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => setters.moveSection(section.id, "up")}
                      disabled={index === 0}
                      aria-label={`Move ${section.kind} section up`}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => setters.moveSection(section.id, "down")}
                      disabled={index === state.sections.length - 1}
                      aria-label={`Move ${section.kind} section down`}
                    >
                      Down
                    </button>
                  </div>
                </div>
                <label>
                  Eyebrow
                  <input
                    type="text"
                    value={section.eyebrow}
                    onChange={(event) =>
                      setters.updateSectionText(section.id, "eyebrow", event.target.value)
                    }
                  />
                </label>
                <label>
                  Title
                  <input
                    type="text"
                    value={section.title}
                    onChange={(event) =>
                      setters.updateSectionText(section.id, "title", event.target.value)
                    }
                  />
                </label>
                <label>
                  Body
                  <textarea
                    rows={3}
                    value={section.body}
                    onChange={(event) =>
                      setters.updateSectionText(section.id, "body", event.target.value)
                    }
                  />
                </label>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="preview-panel" aria-label="Live landing page preview">
        <div className="preview-panel-header">
          <div>
            <p className="eyebrow">Live Preview</p>
            <h2>{state.projectMeta.goal}</h2>
          </div>
          <button type="button" onClick={setters.exportProject}>
            Export mock
          </button>
        </div>
        <LandingPreview state={state} />
        <p className="status-line">{state.exportQuota.message}</p>
      </section>
    </div>
  );
}
