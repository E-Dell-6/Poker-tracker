import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { ACCENTS } from "../../styles/accents";

// The accent color drives every button, active nav item, tag and chart
// accent in the app through a single --color-accent token, so this one
// control re-themes the whole thing.
//
// Light mode is deliberately absent for now: the token plumbing is in place
// (theme.css carries data-theme, the API accepts 'light'/'system'), but ~190
// hardcoded colors still sit in component CSS and each one missed is a
// white-on-white regression.
export function AppearanceSection() {
  const { accent, setAccent } = useTheme();
  const [error, setError] = useState("");

  const choose = async (key) => {
    setError("");
    const result = await setAccent(key);
    if (!result?.success) setError(result?.message ?? "Could not save preference");
  };

  return (
    <section className="settings-section" id="appearance">
      <h2 className="settings-section-title"><Palette size={17} /> Appearance</h2>
      <p className="settings-section-sub">
        Applies everywhere and follows your account to any device you sign in on.
      </p>

      <div className="settings-row">
        <div className="settings-row-info">
          <div className="settings-row-label">Accent color</div>
          <div className="settings-row-hint">
            Used for buttons, active navigation, tags and charts.
          </div>
        </div>
      </div>

      <div className="accent-swatches" role="group" aria-label="Accent color">
        {ACCENTS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            /* data-accent makes the swatch paint itself from theme.css, so
               the hex values never need a second home in JS. */
            data-accent={key}
            className={`accent-swatch ${accent === key ? "selected" : ""}`}
            onClick={() => choose(key)}
            aria-pressed={accent === key}
            aria-label={label}
            title={label}
          >
            {accent === key && <Check size={15} strokeWidth={3} />}
          </button>
        ))}
      </div>

      {error && <p className="settings-error">{error}</p>}

      {/* A live sample, so the choice is legible without leaving the page. */}
      <div className="accent-preview">
        <div className="settings-row-label">Preview</div>
        <div className="accent-preview-row">
          <button type="button" className="settings-btn settings-btn--primary" disabled>
            Primary button
          </button>
          <span className="accent-preview-tag">Reg</span>
          <span className="accent-preview-pos">+$1,240</span>
          <span className="accent-preview-neg">−$310</span>
        </div>
      </div>
    </section>
  );
}

export default AppearanceSection;
