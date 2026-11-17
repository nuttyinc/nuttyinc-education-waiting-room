const COOKIE = '__Host-nuttyinc_guest';
export function guestSession(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? 'guest:' + token : null;
}
export function newGuestSession() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  return { id: 'guest:' + token, cookie: COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200' };
}
export function displayName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 30 && !/[\x00-\x1f\x7f]/.test(name) ? name : null;
}
