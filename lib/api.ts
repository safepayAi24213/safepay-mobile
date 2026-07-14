import Constants from 'expo-constants';

/**
 * Thin typed HTTP client for the SafePay backend.
 *
 * Base URL resolution order:
 *   1. EXPO_PUBLIC_API_URL (set in .env / app.json extra / shell)
 *   2. The dev fallback below — dynamically resolved from your Mac's LAN IP
 *      via expo-constants, so it adapts to different Wi-Fi networks automatically.
 */

// Used only when Metro reports a loopback host (localhost mode) or hostUri is
// unavailable. Set this to your Mac's current LAN IP (`ipconfig getifaddr en0`).
const LAN_FALLBACK = 'http://172.20.10.4:8000';

const getDevApiUrl = (): string => {
  // If EXPO_PUBLIC_API_URL is explicitly defined, prioritize it
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Extract the host IP dynamically from Metro's hostUri so it adapts to
  // different Wi-Fi networks automatically — but never a loopback address,
  // which on a phone points at the phone itself, not the Mac.
  if (__DEV__ && Constants.expoConfig?.hostUri) {
    const hostIp = Constants.expoConfig.hostUri.split(':')[0];
    const isLoopback = !hostIp || hostIp === '127.0.0.1' || hostIp === 'localhost';
    if (!isLoopback) {
      return `http://${hostIp}:8000`;
    }
  }

  return LAN_FALLBACK;
};

export const API_BASE_URL = getDevApiUrl();

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type RequestOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  /** For OAuth2 password flow — sends application/x-www-form-urlencoded */
  form?: Record<string, string>;
  token?: string;
  signal?: AbortSignal;
  /** Extra headers (used for device context on login/register) */
  extraHeaders?: Record<string, string>;
};

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, form, token, signal, extraHeaders } = opts;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  let payload: BodyInit | undefined;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    if (body instanceof FormData) {
      // For FormData, let the fetch implementation set the boundary headers automatically.
      payload = body as any;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const url = `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: payload, signal });
  } catch (err) {
    throw new ApiError(
      `Network error reaching ${url}. Is the backend running and your phone on the same Wi-Fi?`,
      0,
      err,
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === 'object' && 'detail' in parsed
        ? (parsed as { detail: unknown }).detail
        : parsed;
    const message =
      typeof detail === 'string'
        ? detail
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, parsed);
  }

  return parsed as T;
}

// ─── Auth types ──────────────────────────────────────────────────────────

export type UserRole = 'user' | 'analyst' | 'admin';

export type UserDTO = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: UserRole;
  registration_status?: string;
  rejection_reason?: string | null;
  id_document_url?: string | null;
  is_active: boolean;
  is_verified: boolean;
  avatar_url: string | null;
  created_at: string;
};

/** Resolve a stored avatar path (e.g. /uploads/avatars/x.jpg) to a full URL. */
export function avatarUri(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${API_BASE_URL}${avatarUrl}`;
}

export type TokenDTO = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: UserDTO;
};

// ─── OTP types ───────────────────────────────────────────────────────────

export type OtpPurpose =
  | 'register'
  | 'login'
  | 'forgot_password'
  | 'device_verify'
  | 'sensitive_action';

export type OtpSendDTO = {
  sent: boolean;
  purpose: OtpPurpose;
  phone: string;
  expires_at: string;
  /** Dev-only: the raw code so QA / demo can self-fill. Null in production. */
  debug_code: string | null;
};

export type OtpVerifyDTO = {
  verified: boolean;
  purpose: OtpPurpose;
  phone: string;
};

// ─── Auth endpoints ──────────────────────────────────────────────────────

export type DeviceContext = {
  device_id?: string;
  device_name?: string;
  platform?: string;
};

function deviceHeaders(ctx?: DeviceContext): Record<string, string> | undefined {
  if (!ctx) return undefined;
  const h: Record<string, string> = {};
  if (ctx.device_id) h['x-device-id'] = ctx.device_id;
  if (ctx.device_name) h['x-device-name'] = ctx.device_name;
  if (ctx.platform) h['x-platform'] = ctx.platform;
  return Object.keys(h).length ? h : undefined;
}

export const auth = {
  register(
    input: {
      full_name: string;
      phone: string;
      password?: string;
      email?: string;
    },
    device?: DeviceContext,
  ) {
    return request<TokenDTO>('/api/v1/auth/register', {
      method: 'POST',
      body: input,
      extraHeaders: deviceHeaders(device),
    });
  },

  /** OAuth2 password flow expects form-encoded body with field `username`. */
  login(email: string, password: string, device?: DeviceContext) {
    return request<TokenDTO>('/api/v1/auth/login', {
      method: 'POST',
      form: { username: email, password },
      extraHeaders: deviceHeaders(device),
    });
  },

  /** Mobile primary login: mobile number + 4-digit transaction PIN. */
  loginPin(phone: string, pin: string, device?: DeviceContext) {
    return request<TokenDTO>('/api/v1/auth/login-pin', {
      method: 'POST',
      body: { phone, pin },
      extraHeaders: deviceHeaders(device),
    });
  },

  forgotPassword(email: string) {
    return request<{ sent: boolean; expires_in: number; debug_code: string | null }>(
      '/api/v1/auth/forgot-password',
      { method: 'POST', body: { email } },
    );
  },

  resetPassword(email: string, code: string, new_password: string) {
    return request<{ reset: boolean }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: { email, code, new_password },
    });
  },

  /** Phone-based reset for mobile customers: verifies the forgot_password OTP. */
  resetPasswordPhone(phone: string, code: string, new_password: string) {
    return request<{ reset: boolean }>('/api/v1/auth/reset-password-phone', {
      method: 'POST',
      body: { phone, code, new_password },
    });
  },

  /** Phone-based PIN reset: verifies the forgot_password OTP, sets a new PIN. */
  resetPinPhone(phone: string, code: string, pin: string) {
    return request<{ reset: boolean }>('/api/v1/auth/reset-pin-phone', {
      method: 'POST',
      body: { phone, code, pin },
    });
  },

  me(token: string) {
    return request<UserDTO>('/api/v1/auth/me', { token });
  },

  otp: {
    send(phone: string, purpose: OtpPurpose = 'register') {
      return request<OtpSendDTO>('/api/v1/auth/otp/send', {
        method: 'POST',
        body: { phone, purpose },
      });
    },

    verify(phone: string, code: string, purpose: OtpPurpose = 'register') {
      return request<OtpVerifyDTO>('/api/v1/auth/otp/verify', {
        method: 'POST',
        body: { phone, code, purpose },
      });
    },
  },
};

// ─── Transactions ────────────────────────────────────────────────────────

export type TxnKind = 'send' | 'bill';
export type MoneySource = 'MTN MoMo' | 'Airtel Money';
export type TxnStatus = 'pending' | 'completed' | 'failed' | 'blocked' | 'queued';
export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export type Signal = { code: string; label: string; weight: number };

export type RiskDTO = {
  level: RiskLevel;
  score: number;
  confidence: number;
  signals: Signal[];
  summary: string;
  ml_probability: number | null;
  rule_score: number | null;
};

export type ApiTransaction = {
  id: string;
  reference: string;
  sender_id: string;
  kind: TxnKind;
  recipient_name: string;
  recipient_phone: string;
  destination_label: string | null;
  source: MoneySource;
  amount: string;        // backend serialises Decimal as string
  fee: string;
  total: string;
  note: string | null;
  status: TxnStatus;
  risk_score: string | null;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CreateTxnInput = {
  kind?: TxnKind;
  recipient_name: string;
  recipient_phone: string;
  destination_label?: string;
  source: MoneySource;
  amount: number;
  note?: string;
  latitude?: number;
  longitude?: number;
};

export type CreateTxnResponse = {
  transaction: ApiTransaction;
  risk: RiskDTO;
};

export type TransactionListResponse = {
  items: ApiTransaction[];
  total: number;
  limit: number;
  offset: number;
};

export type ReceivedTransaction = {
  id: string;
  sender_name: string;
  sender_phone: string | null;
  sender_avatar_url: string | null;
  source: MoneySource;
  amount: string;
  note: string | null;
  status: TxnStatus;
  created_at: string;
};

export type ReceivedListResponse = {
  items: ReceivedTransaction[];
  total: number;
};

export const transactions = {
  send(token: string, input: CreateTxnInput) {
    return request<CreateTxnResponse>('/api/v1/transactions', {
      method: 'POST',
      body: input,
      token,
    });
  },
  list(token: string, opts: { limit?: number; offset?: number; kind?: TxnKind } = {}) {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.offset) qs.set('offset', String(opts.offset));
    if (opts.kind) qs.set('kind', opts.kind);
    const q = qs.toString();
    return request<TransactionListResponse>(
      `/api/v1/transactions${q ? `?${q}` : ''}`,
      { token },
    );
  },
  received(token: string, opts: { limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.offset) qs.set('offset', String(opts.offset));
    const q = qs.toString();
    return request<ReceivedListResponse>(
      `/api/v1/transactions/received${q ? `?${q}` : ''}`,
      { token },
    );
  },
  get(token: string, id: string) {
    return request<ApiTransaction>(`/api/v1/transactions/${id}`, { token });
  },
};

// ─── Risk (real-time scoring preview) ──────────────────────────────────────

export const risk = {
  /** Score a hypothetical transaction without persisting it (the REAL engine). */
  scorePreview(token: string, input: CreateTxnInput) {
    return request<RiskDTO>('/api/v1/risk/score-preview', {
      method: 'POST', token, body: input,
    });
  },
};

// ─── Fraud alerts ────────────────────────────────────────────────────────

export type AlertStatus = 'pending' | 'confirmed' | 'reported' | 'auto_blocked';

export type ApiFraudAlert = {
  id: string;
  user_id: string;
  transaction_id: string | null;
  level: RiskLevel;
  score: string;
  confidence: string;
  signals: Signal[];
  summary: string;
  status: AlertStatus;
  created_at: string;
  resolved_at: string | null;
};

export type AlertListResponse = {
  items: ApiFraudAlert[];
  total: number;
  pending_count: number;
};

export const alerts = {
  list(token: string, opts: { limit?: number; status?: AlertStatus } = {}) {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.status) qs.set('status', opts.status);
    const q = qs.toString();
    return request<AlertListResponse>(`/api/v1/fraud/alerts${q ? `?${q}` : ''}`, { token });
  },
  respond(token: string, id: string, response: 'yes_me' | 'report_fraud', freezeAccount = false) {
    return request<{ id: string; status: AlertStatus; resolved_at: string }>(
      `/api/v1/fraud/alerts/${id}/respond`,
      { method: 'POST', token, body: { response, freeze_account: freezeAccount } },
    );
  },
};

// ─── Wallets ─────────────────────────────────────────────────────────────

export type WalletDTO = {
  id: string;
  source: MoneySource;
  balance: string;
  currency: string;
  updated_at: string;
};

export type WalletListResponse = {
  items: WalletDTO[];
  total_balance: string;
};

export const wallets = {
  mine(token: string) {
    return request<WalletListResponse>('/api/v1/users/me/wallets', { token });
  },
};

// ─── Profile (avatar) ─────────────────────────────────────────────────────

export type AvatarAsset = { uri: string; name?: string; mimeType?: string };

export const users = {
  /** Multipart upload of a profile picture; returns the updated user. */
  async uploadAvatar(token: string, asset: AvatarAsset): Promise<UserDTO> {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.name ?? 'avatar.jpg',
      type: asset.mimeType ?? 'image/jpeg',
      // React Native's FormData accepts this shape; TS types don't model it.
    } as unknown as Blob);

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/v1/users/me/avatar`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: form,
      });
    } catch (err) {
      throw new ApiError('Network error uploading photo.', 0, err);
    }
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'detail' in parsed
          ? (parsed as { detail: unknown }).detail
          : parsed;
      throw new ApiError(
        typeof detail === 'string' ? detail : 'Upload failed',
        res.status,
        parsed,
      );
    }
    return parsed as UserDTO;
  },

  removeAvatar(token: string) {
    return request<UserDTO>('/api/v1/users/me/avatar', { method: 'DELETE', token });
  },

  /** Update editable profile fields (name, phone). */
  updateProfile(token: string, input: { full_name?: string; phone?: string }) {
    return request<UserDTO>('/api/v1/users/me', { method: 'PATCH', token, body: input });
  },

  notifications: {
    get(token: string) {
      return request<NotificationPrefs>('/api/v1/users/me/notifications', { token });
    },
    update(token: string, input: Partial<NotificationPrefs>) {
      return request<NotificationPrefs>('/api/v1/users/me/notifications', {
        method: 'PUT', token, body: input,
      });
    },
  },
};

export type NotificationPrefs = {
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  txn_alerts: boolean;
  fraud_alerts: boolean;
  marketing: boolean;
};

export type LinkedAccount = {
  id: string;
  source: MoneySource;
  account_number: string;
  label: string;
  linked_at: string;
};

// ─── Onboarding ──────────────────────────────────────────────────────────

export const onboarding = {
  verifyId(token: string, input: { id_type: 'national_id' | 'passport'; national_id: string }) {
    return request<{ id_type: string; national_id: string; id_verified_at: string }>(
      '/api/v1/auth/verify-id',
      { method: 'POST', token, body: input },
    );
  },
  uploadIdDocument(token: string, fileUri: string) {
    const formData = new FormData();
    const name = fileUri.split('/').pop() || 'id.jpg';
    const match = /\.(\w+)$/.exec(name);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('file', {
      uri: fileUri,
      name,
      type,
    } as any);

    return request<{ id_document_url: string }>('/api/v1/auth/verify-id/document', {
      method: 'POST',
      token,
      body: formData,
    });
  },
  setPin(token: string, pin: string) {
    return request<{ set: boolean }>('/api/v1/auth/pin', {
      method: 'POST', token, body: { pin },
    });
  },
  verifyPin(token: string, pin: string) {
    return request<{ verified: boolean }>('/api/v1/auth/pin/verify', {
      method: 'POST', token, body: { pin },
    });
  },
  linkMoney(token: string, source: MoneySource, account_number: string, label?: string) {
    return request<LinkedAccount>(
      '/api/v1/auth/link-money',
      { method: 'POST', token, body: { source, account_number, label } },
    );
  },
  listAccounts(token: string) {
    return request<LinkedAccount[]>('/api/v1/auth/accounts', { token });
  },
  unlinkAccount(token: string, id: string) {
    return request<void>(`/api/v1/auth/link-money/${id}`, { method: 'DELETE', token });
  },
};

// ─── Sessions / Login history / Trusted devices ─────────────────────────

export type SessionDTO = {
  id: string;
  device_name: string | null;
  platform: string | null;
  location: string | null;
  ip_address: string | null;
  is_current: boolean;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

export type LoginEventDTO = {
  id: string;
  status: 'success' | 'failure' | 'blocked';
  device_name: string | null;
  platform: string | null;
  location: string | null;
  ip_address: string | null;
  reason: string | null;
  created_at: string;
};

export type TrustedDeviceDTO = {
  id: string;
  device_id: string;
  device_name: string;
  platform: string | null;
  model: string | null;
  is_current: boolean;
  last_used_at: string;
  created_at: string;
  revoked_at: string | null;
};

export const security = {
  sessions(token: string) {
    return request<{ items: SessionDTO[] }>('/api/v1/auth/sessions', { token });
  },
  revokeSession(token: string, id: string) {
    return request<SessionDTO>(`/api/v1/auth/sessions/${id}`, {
      method: 'DELETE', token,
    });
  },
  loginHistory(token: string, limit = 50) {
    return request<{ items: LoginEventDTO[] }>(
      `/api/v1/auth/login-history?limit=${limit}`,
      { token },
    );
  },
  devices(token: string) {
    return request<{ items: TrustedDeviceDTO[] }>('/api/v1/auth/devices', { token });
  },
  registerDevice(
    token: string,
    input: { device_id: string; device_name: string; platform?: string; model?: string },
  ) {
    return request<TrustedDeviceDTO>('/api/v1/auth/devices', {
      method: 'POST', token, body: input,
    });
  },
  revokeDevice(token: string, devicePk: string) {
    return request<TrustedDeviceDTO>(`/api/v1/auth/devices/${devicePk}`, {
      method: 'DELETE', token,
    });
  },
};

// ─── Billers ─────────────────────────────────────────────────────────────

export type BillerCategory =
  | 'utilities' | 'telecom' | 'tv' | 'internet' | 'insurance' | 'other';

export type BillerDTO = {
  id: string;
  code: string;
  name: string;
  category: BillerCategory;
  account_label: string;
  account_hint: string | null;
  logo_url: string | null;
};

export const billers = {
  list() {
    return request<{ items: BillerDTO[] }>('/api/v1/billers');
  },
};

// ─── Health ──────────────────────────────────────────────────────────────

export const health = () => request<{ status: string }>('/health');
