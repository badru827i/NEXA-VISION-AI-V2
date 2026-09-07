const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: 'include', ...init });
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}
export { API };
