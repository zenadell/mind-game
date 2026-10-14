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
  return data as T;
}
