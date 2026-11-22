import type { ProviderConfig, SmsMessage, SmsProvider, SmsSendResult } from "./types";

/**
 * Провайдер для розробки і тестів: нічого не відправляє, пише в лог.
 * Ніколи не вмикається в продакшні.
 */
export function createConsoleProvider(
  _config: Pick<ProviderConfig, "senderName">,
  log: (line: string) => void = console.log,
): SmsProvider {
  return {
    id: "console",
    async send(message: SmsMessage): Promise<SmsSendResult> {
      log(`[sms:console] to=${message.to} text=${message.text}`);
      return { ok: true, providerMessageId: `console-${Date.now()}` };
    },
  };
}

/**
 * TurboSMS (https://turbosms.ua). Endpoint і напрям токена взято з офіційної
 * документації: POST https://api.turbosms.ua/message/send.json.
 *
 * УВАГА: точні імена полів тіла запиту і спосіб передачі токена мають бути
 * перевірені на тестовому акаунті TurboSMS перед запуском. Позначено в
 * docs/decisions.md як «потребує перевірки».
 */
export function createTurboSmsProvider(config: ProviderConfig): SmsProvider {
  const fetchFn = config.fetchImpl ?? fetch;
  return {
    id: "turbosms",
    async send(message: SmsMessage): Promise<SmsSendResult> {
      try {
        const res = await fetchFn("https://api.turbosms.ua/message/send.json", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.credentials.token}`,
          },
          body: JSON.stringify({
            recipients: [message.to.replace(/^\+/, "")],
            sms: { sender: config.senderName, text: message.text },
          }),
        });
        if (!res.ok) {
          return {
            ok: false,
            error: `TurboSMS HTTP ${res.status}`,
            retryable: res.status >= 500 || res.status === 429,
          };
        }
        const body = (await res.json()) as { response_code?: number; response_status?: string };
        // Успішна відповідь TurboSMS містить код 0 або статус OK; інше — помилка провайдера.
        if (body.response_code !== undefined && body.response_code !== 0) {
          return {
            ok: false,
            error: `TurboSMS: ${body.response_status ?? body.response_code}`,
            retryable: false,
          };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Мережева помилка",
          retryable: true,
        };
      }
    },
  };
}
