import { useNavigate } from "react-router-dom";
import { LandingPreview } from "../components/LandingPreview";
import { useDesignStudio } from "../state/designStore";

export function Templates() {
  const { state, setters } = useDesignStudio();
  const navigate = useNavigate();

  return (
    <div className="route-stack">
      <div className="route-header">
        <p className="eyebrow">Templates</p>
        <h2>Starting directions</h2>
        <span>Apply a complete palette, type scale, hero layout, and section set.</span>
      </div>

      <div className="template-grid">
        {state.templates.map((template) => {
          const previewState = {
            ...state,
            palette: template.palette,
            typography: template.typography,
            heroLayout: template.heroLayout,
            sections: template.sections,
            projectMeta: {
              ...state.projectMeta,
              ...template.metaPatch,
            },
          };

          return (
            <article key={template.id} className="template-card">
              <LandingPreview state={previewState} compact />
              <div className="template-card-body">
                <div>
                  <p className="eyebrow">
                    {state.activeTemplateId === template.id ? "Current" : "Template"}
                  </p>
                  <h3>{template.name}</h3>
                  <span>{template.description}</span>
                </div>
                <div className="button-row">
                  <button type="button" onClick={() => setters.applyTemplate(template.id)}>
                    Apply
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setters.applyTemplate(template.id);
                      navigate("/");
                    }}
                  >
                    Apply and edit
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
