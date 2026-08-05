export type SessionState = { authenticated: true; username: string } | { authenticated: false };

export async function fetchSession(): Promise<SessionState> {
  try {
    const response = await fetch("/api/session", { credentials: "include" });
    if (!response.ok) return { authenticated: false };
    return (await response.json()) as SessionState;
  } catch {
    return { authenticated: false };
  }
}

export type LoginResult = { ok: true; username: string } | { ok: false; error: string };

export async function login(username: string, password: string): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection." };
  }
  const body = (await response.json().catch(() => ({}))) as {
    username?: string;
    error?: string;
  };
  if (!response.ok) return { ok: false, error: body.error ?? "Sign-in failed." };
  return { ok: true, username: body.username ?? username };
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
}
