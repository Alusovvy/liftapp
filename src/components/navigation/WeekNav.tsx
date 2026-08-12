type WeekNavProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
};

export function WeekNav({
  label,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
}: WeekNavProps) {
  return (
    <div className="week-nav" role="group" aria-label="Select week">
      <button
        className="week-nav-button"
        type="button"
        onClick={onPrevious}
        disabled={previousDisabled}
        aria-label="Previous week"
      >
        ←
      </button>
      <span className="week-nav-label">{label}</span>
      <button
        className="week-nav-button"
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Next week"
      >
        →
      </button>
    </div>
  );
}
