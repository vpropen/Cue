import { createConsoleProvider, createTurboSmsProvider } from "./providers";
import type { ProviderConfig, SmsProvider } from "./types";

export type ProviderStatus = "available" | "planned";

export type ProviderInfo = {
  id: string;
  title: string;
  status: ProviderStatus;
  /** Примітка для власника салону або розробника */
  note: string;
};

/**
 * Каталог українських SMS-провайдерів. Лише статус "available" можна обрати в налаштуваннях салону.
 * "planned" — відомий провайдер, адаптер ще не написано і не перевірено.
 */
export const SMS_PROVIDER_CATALOG: readonly ProviderInfo[] = [
  {
    id: "turbosms",
    title: "TurboSMS",
    status: "available",
    note: "Адаптер написано за офіційним endpoint. Потребує перевірки полів на тестовому акаунті.",
  },
  {
    id: "smsclub",
    title: "SMSClub",
    status: "planned",
    note: "Відомий endpoint im.smsclub.mobi/sms/send. Спосіб авторизації та поля не перевірено.",
  },
  {
    id: "alphasms",
    title: "AlphaSMS",
    status: "planned",
    note: "Є публічна JSON-документація API v1.5. Ще не реалізовано.",
  },
];

const FACTORIES: Record<string, (config: ProviderConfig) => SmsProvider> = {
  turbosms: createTurboSmsProvider,
};

/**
 * Створює провайдер за ідентифікатором. Кидає помилку для невідомого
 * або ще не реалізованого провайдера, щоб не відправляти SMS непередбачувано.
 */
export function createSmsProvider(id: string, config: ProviderConfig): SmsProvider {
  const info = SMS_PROVIDER_CATALOG.find((p) => p.id === id);
  if (!info) throw new Error(`Невідомий SMS-провайдер: ${id}`);
  if (info.status !== "available") {
    throw new Error(`SMS-провайдер ${info.title} ще не підключено`);
  }
  const factory = FACTORIES[id];
  if (!factory) throw new Error(`Немає адаптера для ${id}`);
  return factory(config);
}

/** Для локальної розробки: провайдер без реальної відправки. */
export function createDevSmsProvider(config: Pick<ProviderConfig, "senderName">): SmsProvider {
  return createConsoleProvider(config);
}
