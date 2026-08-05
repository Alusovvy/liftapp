type DataProblemProps = {
  message: string;
  rawRecoveryAvailable?: boolean;
};

export function DataProblem({ message, rawRecoveryAvailable = false }: DataProblemProps) {
  return (
    <main className="standalone-state" id="main-content">
      <p className="eyebrow">DATA RECOVERY</p>
      <h1>Your saved data was left untouched</h1>
      <p>{message}</p>
      {rawRecoveryAvailable ? (
        <p>A raw recovery copy was stored locally before this screen appeared.</p>
      ) : null}
      <a className="button button-primary" href="./index.html">
        Open recovery tools
      </a>
    </main>
  );
}
