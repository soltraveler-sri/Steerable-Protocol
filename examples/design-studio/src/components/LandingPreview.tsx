import type { CSSProperties } from "react";
import type { DesignState, LandingSection } from "../types";

const pairingStyles = {
  atelier: {
    heading: "Georgia, 'Times New Roman', serif",
    body: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  editorial: {
    heading: "'Iowan Old Style', Georgia, serif",
    body: "'Avenir Next', Inter, ui-sans-serif, system-ui, sans-serif",
  },
  modern: {
    heading: "Inter, ui-sans-serif, system-ui, sans-serif",
    body: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
};

const scaleStyles = {
  compact: {
    title: "2.55rem",
    section: "1.55rem",
    body: "0.9rem",
  },
  standard: {
    title: "3.2rem",
    section: "1.85rem",
    body: "1rem",
  },
  expressive: {
    title: "4rem",
    section: "2.25rem",
    body: "1.08rem",
  },
};

function PreviewHero({ section, state }: { section: LandingSection; state: DesignState }) {
  return (
    <section className={`preview-hero ${state.heroLayout}`}>
      <div>
        <p>{section.eyebrow}</p>
        <h2>{section.title}</h2>
        <span>{section.body}</span>
        <div className="preview-actions">
          <button type="button">
            {state.projectMeta.tone === "premium" ? "Book viewing" : "Join waitlist"}
          </button>
          <span className="preview-link">View details</span>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <span />
        <strong>{state.projectMeta.audience}</strong>
      </div>
    </section>
  );
}

function PreviewSection({ section }: { section: LandingSection }) {
  if (section.kind === "features") {
    return (
      <section className="preview-section preview-features">
        <div>
          <p>{section.eyebrow}</p>
          <h3>{section.title}</h3>
          <span>{section.body}</span>
        </div>
        <div className="feature-grid" aria-hidden="true">
          <span>Brief</span>
          <span>Tokens</span>
          <span>Mockup</span>
        </div>
      </section>
    );
  }

  if (section.kind === "socialProof") {
    return (
      <section className="preview-section preview-quote">
        <p>{section.eyebrow}</p>
        <blockquote>{section.title}</blockquote>
        <span>{section.body}</span>
      </section>
    );
  }

  if (section.kind === "pricing") {
    return (
      <section className="preview-section preview-pricing">
        <div>
          <p>{section.eyebrow}</p>
          <h3>{section.title}</h3>
          <span>{section.body}</span>
        </div>
        <button type="button">Reserve spot</button>
      </section>
    );
  }

  if (section.kind === "footer") {
    return (
      <footer className="preview-section preview-footer">
        <p>{section.eyebrow}</p>
        <h3>{section.title}</h3>
        <span>{section.body}</span>
      </footer>
    );
  }

  return null;
}

export function LandingPreview({ state, compact = false }: { state: DesignState; compact?: boolean }) {
  const sections = state.sections.filter((section) => section.visible);
  const pairing = pairingStyles[state.typography.fontPairing];
  const scale = scaleStyles[state.typography.scale];

  const style = {
    "--preview-bg": state.palette.background,
    "--preview-surface": state.palette.surface,
    "--preview-text": state.palette.text,
    "--preview-muted": state.palette.muted,
    "--preview-accent": state.palette.accent,
    "--preview-accent-contrast": state.palette.accentContrast,
    "--preview-border": state.palette.border,
    "--preview-heading-font": pairing.heading,
    "--preview-body-font": pairing.body,
    "--preview-title-size": scale.title,
    "--preview-section-size": scale.section,
    "--preview-body-size": scale.body,
  } as CSSProperties;

  return (
    <div className={compact ? "preview-frame compact" : "preview-frame"} style={style}>
      <article className="landing-preview">
        {sections.length > 0 ? (
          sections.map((section) =>
            section.kind === "hero" ? (
              <PreviewHero key={section.id} section={section} state={state} />
            ) : (
              <PreviewSection key={section.id} section={section} />
            ),
          )
        ) : (
          <section className="preview-section">
            <p>Empty page</p>
            <h3>No visible sections</h3>
            <span>Turn a section back on to rebuild the landing page.</span>
          </section>
        )}
      </article>
    </div>
  );
}
