import type { LiftwiseData } from "../../domain/models/schema";

type SettingsPageProps = {
  data: LiftwiseData;
};

export function SettingsPage({ data }: SettingsPageProps) {
  const enabledEquipment = Object.entries(data.profile.equipment)
    .filter(([, enabled]) => enabled)
    .map(([id]) => id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings & data</p>
          <h1>Control the inputs</h1>
          <p className="page-intro">Your targets and equipment constrain recommendations.</p>
        </div>
      </header>
      <section className="settings-grid">
        <article>
          <h2>Profile and units</h2>
          <dl>
            <div><dt>Name</dt><dd>{data.profile.name}</dd></div>
            <div><dt>Training days</dt><dd>{data.profile.days} per week</dd></div>
            <div><dt>Experience</dt><dd>{data.profile.experience}</dd></div>
            <div><dt>Units</dt><dd>{data.profile.units}</dd></div>
          </dl>
        </article>
        <article>
          <h2>Available equipment</h2>
          <p>{enabledEquipment.length ? enabledEquipment.join(" · ") : "Bodyweight only"}</p>
        </article>
        <article>
          <h2>Data ownership</h2>
          <p>
            {data.workouts.length} workouts · {data.routines.length} routines · {data.nutritionDays.length} nutrition days
          </p>
          <p>Stored locally in this browser.</p>
        </article>
      </section>
      <a className="button button-primary" href="./index.html">
        Open profile, backup & restore tools
      </a>
    </div>
  );
}
