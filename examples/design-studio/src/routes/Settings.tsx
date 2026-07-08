import { useDesignStudio } from "../state/designStore";
import type { ProjectMeta } from "../types";

const tones: Array<{ value: ProjectMeta["tone"]; label: string }> = [
  { value: "warm", label: "Warm" },
  { value: "direct", label: "Direct" },
  { value: "premium", label: "Premium" },
];

export function Settings() {
  const { state, setters } = useDesignStudio();

  return (
    <div className="settings-grid">
      <section className="settings-panel">
        <div className="route-header">
          <p className="eyebrow">Settings</p>
          <h2>Project details</h2>
          <span>These fields feed the preview and future export labels.</span>
        </div>

        <label>
          Project name
          <input
            type="text"
            value={state.projectMeta.name}
            onChange={(event) => setters.updateProjectMeta("name", event.target.value)}
          />
        </label>
        <label>
          Audience
          <input
            type="text"
            value={state.projectMeta.audience}
            onChange={(event) => setters.updateProjectMeta("audience", event.target.value)}
          />
        </label>
        <label>
          Page goal
          <textarea
            rows={3}
            value={state.projectMeta.goal}
            onChange={(event) => setters.updateProjectMeta("goal", event.target.value)}
          />
        </label>
        <label>
          Share slug
          <input
            type="text"
            value={state.projectMeta.shareSlug}
            onChange={(event) => setters.updateProjectMeta("shareSlug", event.target.value)}
          />
        </label>
        <div>
          <span className="field-label">Tone</span>
          <div className="segmented" aria-label="Tone">
            {tones.map((tone) => (
              <button
                key={tone.value}
                type="button"
                className={state.projectMeta.tone === tone.value ? "selected" : ""}
                onClick={() => setters.updateProjectMeta("tone", tone.value)}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="settings-panel operations-panel">
        <div>
          <p className="eyebrow">Mock operations</p>
          <h2>Export quota</h2>
          <div className="quota-meter" aria-label="Export quota">
            <strong>
              {state.exportQuota.remaining}/{state.exportQuota.limit}
            </strong>
            <span>mock exports left today</span>
          </div>
          <p className="status-line">{state.exportQuota.message}</p>
          {state.exportQuota.lastExportedAt ? (
            <p className="status-line">Last mock export: {state.exportQuota.lastExportedAt}</p>
          ) : null}
        </div>

        <div className="operation-buttons">
          <button type="button" className="primary" onClick={setters.exportProject}>
            Export mock
          </button>
          <button type="button" onClick={setters.copyShareLink}>
            Copy share link
          </button>
          <p className="status-line">{state.shareMessage}</p>
        </div>

        <div className="danger-zone">
          <h3>Reset project</h3>
          <p>Return the design and metadata to the starter state while keeping today's quota count.</p>
          <button type="button" className="danger" onClick={setters.resetProject}>
            Reset project
          </button>
        </div>
      </aside>
    </div>
  );
}
