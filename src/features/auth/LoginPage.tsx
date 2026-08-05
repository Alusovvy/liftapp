import { useState, type FormEvent } from "react";
import { login } from "../../infrastructure/remote/auth-client";

type LoginPageProps = {
  onSignedIn: (username: string) => void;
};

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(username, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSignedIn(result.username);
  };

  return (
    <main className="standalone-state" id="main-content">
      <p className="eyebrow">LIFTWISE</p>
      <h1>Sign in</h1>
      <p>Accounts are created by an admin. Ask them for your username and password.</p>
      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-field">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <div className="import-error" role="alert">
            <strong>Sign-in failed</strong>
            <span>{error}</span>
          </div>
        ) : null}
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
