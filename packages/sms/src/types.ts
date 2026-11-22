/** Один SMS для відправки. Номер у форматі E.164 (+380…). */
export type SmsMessage = {
  to: string;
  text: string;
};

export type SmsSendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string; retryable: boolean };

/**
 * Спільний інтерфейс для всіх SMS-провайдерів.
 * Кожен салон підключає один провайдер із власними обліковими даними і назвою відправника.
 */
export interface SmsProvider {
  readonly id: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

export type ProviderCredentials = {
  /** API-ключ або токен; береться з Supabase Vault, не зі звичайних полів БД */
  token: string;
};

export type ProviderConfig = {
  credentials: ProviderCredentials;
  senderName: string;
  /** Для тестів: підміна fetch */
  fetchImpl?: typeof fetch;
};
