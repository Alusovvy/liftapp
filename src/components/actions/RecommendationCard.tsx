import { useState } from "react";
import { evidenceLabel } from "../../domain/coaching/evidence-sufficiency";
import type { CoachingAction } from "../../domain/coaching/types";

type RecommendationCardProps = {
  action: CoachingAction;
  primaryHref?: string;
  onAlternative?: () => void;
};

export function RecommendationCard({
  action,
  primaryHref = "./index.html",
  onAlternative,
}: RecommendationCardProps) {
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
        <a
          className={safety ? "button button-safety" : "button button-primary"}
          href={primaryHref}
        >
          {action.primaryActionLabel}
        </a>
        {action.alternativeActionLabel ? (
          <button className="button button-secondary" type="button" onClick={onAlternative}>
            {action.alternativeActionLabel}
          </button>
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
            This is a transparent planning rule based on your saved inputs. It is not a
            readiness score or medical conclusion.
          </p>
        </div>
      ) : null}
    </article>
  );
}
