// start.ng owns sign-in. The game talks to it through a hidden start.ng/connect page.
// The game never sees the start.ng token, password, or email.

function findStartNg() {
  const { hostname } = location;
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  if (hostname.endsWith('.start.localhost')) return 'http://start.localhost:5173';
  return null;
}

export const START_NG = findStartNg();

export const DEFAULT_GUEST = {
  name: 'Guest',
  style: {
    body: 'female',
    primaryColor: '#a55eea',
    secondaryColor: '#0c6e5a',
    skinColor: '#8d5524',
    hairColor: '#17120f',
    hair: 'braids',
    hat: 'none',
    accessory: 'none',
  },
  face: '',
};

export const GAME = location.hostname.endsWith('.start.ng')
  ? location.hostname.split('.')[0]
  : null;

export function storeSessionFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const session = params.get('startng_session');
  if (session) {
    sessionStorage.setItem('startng_session', session);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return session;
}

export function getSession() {
  return sessionStorage.getItem('startng_session');
}

let frame;

function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.title = 'start.ng sign-in check';
    el.addEventListener('load', () => resolve(el), { once: true });
    el.addEventListener('error', reject, { once: true });
    document.body.append(el);
  });
  return frame;
}

async function askStartNg(message, replyType, timeoutMs = 5000) {
  if (!START_NG) return null;
  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

/** { user, guest } — user is null when signed out. */
export async function whoami() {
  // Prefer the connect page (postMessage) on *.start.ng.
  if (START_NG) {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
    if (reply) {
      return {
        user: reply.user ?? null,
        guest: reply.guest ?? DEFAULT_GUEST,
      };
    }
  }
  // Fall back to the HTTP API with a game session (works on mobile where
  // hidden iframes / postMessage can be blocked).
  const session = getSession();
  if (session && GAME) {
    try {
      const res = await fetch(`https://api.start.ng/games/${GAME}/player`, {
        headers: { Authorization: `Bearer ${session}` },
      });
      if (res.ok) {
        const player = await res.json();
        return { user: player, guest: DEFAULT_GUEST };
      }
      if (res.status === 401) sessionStorage.removeItem('startng_session');
    } catch {}
  }
  return { user: null, guest: DEFAULT_GUEST };
}

export function onUserChange(fn) {
  const recheck = async () => {
    if (document.visibilityState !== 'visible') return;
    const reply = await whoami();
    fn(reply);
  };
  document.addEventListener('visibilitychange', recheck);
  addEventListener('focus', recheck);
}

export async function saveScore(stats) {
  // Prefer the connect page (postMessage) on *.start.ng.
  if (START_NG) {
    const saved = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved');
    if (saved) return saved;
  }
  // Fall back to the HTTP API with a game session (works on mobile).
  const session = getSession();
  if (session && GAME) {
    try {
      const res = await fetch(`https://api.start.ng/games/${GAME}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({ stats }),
      });
      if (res.ok) {
        const saved = await res.json();
        return { ok: true, result: saved };
      }
      if (res.status === 401) {
        sessionStorage.removeItem('startng_session');
        return { ok: false, error: 'Sign in to save your score' };
      }
    } catch {}
  }
  return { ok: false, error: 'Sign in to save your score' };
}

export async function getLeaderboard(limit = 10) {
  // Prefer the connect page (postMessage) on *.start.ng.
  if (START_NG) {
    const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData');
    if (reply?.ok) return reply.entries;
  }
  // Fall back to the HTTP API (no auth needed to read the board).
  if (GAME) {
    try {
      const res = await fetch(`https://api.start.ng/games/${GAME}/leaderboard?limit=${limit}`);
      if (res.ok) return await res.json();
    } catch {}
  }
  return [];
}

export function signIn() {
  const dest = START_NG ?? 'https://start.ng';
  location.href = `${dest}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

export function isGuestUrl() {
  return new URLSearchParams(location.search).has('guest');
}
