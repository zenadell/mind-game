"use client";

/** POST JSON and return JSON; throws with the server's friendly error message. */
export async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong.");
  window.dispatchEvent(new Event("ct-stats"));
  // Celebrate any XP the action earned (the game layer listens for this).
  const d = data as { game?: unknown; completion?: { game?: unknown } };
  for (const g of [d.game, d.completion?.game]) if (g) window.dispatchEvent(new CustomEvent("ct-game", { detail: g }));
  return data as T;
}

/** Ask the tutor chat (next to the lesson) to explain something more. */
export function askTutor(text: string) {
  window.dispatchEvent(new CustomEvent("ct-ask", { detail: text }));
}
