export const ADMIN_TOKEN_KEY = 'strangerchat_admin_token';

export const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAdminToken = (token: string): void => {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // LocalStorage write failed or blocked
  }
};

export const clearAdminToken = (): void => {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // LocalStorage clear failed
  }
};

export const adminFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAdminToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin_unauthorized'));
    }
  }

  return response;
};
