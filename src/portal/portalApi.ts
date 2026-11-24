import { apiUrl, createIdempotencyKey } from '../lib/apiClient';

const TOKEN_STORAGE_KEY = 'opm_portal_session_token';

let onUnauthorizedHandler: (() => void) | null = null;

export function setPortalUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorizedHandler = fn;
}

export function getPortalToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPortalToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export class PortalApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'PortalApiError';
  }
}

export async function portalRequest<T = any>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    idempotent?: boolean;
    skipAuth?: boolean;
  }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = options?.skipAuth ? null : getPortalToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options?.idempotent) {
    headers['Idempotency-Key'] = createIdempotencyKey();
  }

  const res = await fetch(apiUrl(`/api/portal${path.startsWith('/') ? path : `/${path}`}`), {
    method: options?.method || 'GET',
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !options?.skipAuth && onUnauthorizedHandler) {
      setPortalToken(null);
      onUnauthorizedHandler();
    }
    throw new PortalApiError(
      res.status,
      data?.error || `Request failed (${res.status})`,
      data?.code
    );
  }
  return data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPortalFile(
  file: File,
  meta?: { projectId?: string; category?: 'brief' | 'reference' | 'message_attachment' | 'support_attachment' }
) {
  const contentBase64 = await fileToBase64(file);
  return portalRequest<{ success: boolean; file: any }>('/files/upload', {
    method: 'POST',
    body: {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64,
      projectId: meta?.projectId,
      category: meta?.category || 'reference',
    },
  });
}

export async function triggerSignedFileDownload(fileId: string) {
  const { downloadUrl } = await portalRequest<{ success: boolean; downloadUrl: string }>(
    `/files/${encodeURIComponent(fileId)}/sign`,
    { method: 'POST' }
  );
  const fullUrl = apiUrl(downloadUrl);
  const a = document.createElement('a');
  a.href = fullUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
