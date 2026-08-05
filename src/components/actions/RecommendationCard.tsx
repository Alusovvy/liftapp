import { useState } from "react";
import { evidenceLabel } from "../../domain/coaching/evidence-sufficiency";
import type { CoachingAction } from "../../domain/coaching/types";

export type RecommendationDestination =
  { type: "link"; href: string } | { type: "action"; onClick: () => void };

type RecommendationCardProps = {
  action: CoachingAction;
  primary: RecommendationDestination;
  alternative?: RecommendationDestination | undefined;
};

function ActionControl({
  destination,
  label,
  className,
}: {
  destination: RecommendationDestination;
  label: string;
  className: string;
}) {
  if (destination.type === "link") {
    return (
      <a className={className} href={destination.href}>
        {label}
      </a>
    );
  }
  return (
    <button className={className} type="button" onClick={destination.onClick}>
      {label}
    </button>
  );
}

export function RecommendationCard({ action, primary, alternative }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const safety = action.kind === "safety";

  return (
    <article className={`recommendation-card recommendation-${action.kind}`}>
      <p className="card-kicker">
        {action.kind === "planned-session" ? "Today · planned" : action.kind.replaceAll("-", " ")}
      </p>
      <h2>{action.title}</h2>
      <p className="recommendation-reason">{action.reason}</p>
      <div className="recommendation-actions">
        <ActionControl
          destination={primary}
          label={action.primaryActionLabel}
          className={safety ? "button button-safety" : "button button-primary"}
        />
        {action.alternativeActionLabel && alternative ? (
          <ActionControl
            destination={alternative}
            label={action.alternativeActionLabel}
            className="button button-secondary"
          />
        ) : null}
      </div>
      <button
        className="evidence-toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        Evidence: {evidenceLabel(action.evidence)}
        <span aria-hidden="true">{expanded ? " −" : " +"}</span>
      </button>
      {expanded ? (
        <div className="evidence-detail">
          <strong>Rule</strong>
          <code>{action.ruleId}</code>
          <p>
            This is a transparent planning rule based on your saved inputs. It is not a readiness
            score or medical conclusion.
          </p>
        </div>
      ) : null}
    </article>
  );
}
