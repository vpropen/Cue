import { describe, expect, it, vi } from "vitest";
import { createSmsProvider, createTurboSmsProvider, SMS_PROVIDER_CATALOG } from "./index";

const creds = { token: "test-token" };

describe("createSmsProvider", () => {
  it("створює доступний провайдер", () => {
    const p = createSmsProvider("turbosms", { credentials: creds, senderName: "Salon" });
    expect(p.id).toBe("turbosms");
  });

  it("відмовляє у запланованому провайдері", () => {
    expect(() =>
      createSmsProvider("smsclub", { credentials: creds, senderName: "Salon" }),
    ).toThrow(/ще не підключено/);
  });

  it("відмовляє у невідомому провайдері", () => {
    expect(() =>
      createSmsProvider("unknown", { credentials: creds, senderName: "Salon" }),
    ).toThrow(/Невідомий/);
  });

  it("каталог містить лише один доступний провайдер на старті", () => {
    const available = SMS_PROVIDER_CATALOG.filter((p) => p.status === "available");
    expect(available.map((p) => p.id)).toEqual(["turbosms"]);
  });
});

describe("TurboSMS adapter", () => {
  it("надсилає запит з токеном і відправником", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ response_code: 0 }), { status: 200 }),
    );
    const p = createTurboSmsProvider({
      credentials: creds,
      senderName: "Salon",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const result = await p.send({ to: "+380671234567", text: "Ваш запис підтверджено" });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.turbosms.ua/message/send.json");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(JSON.parse(init.body as string)).toEqual({
      recipients: ["380671234567"],
      sms: { sender: "Salon", text: "Ваш запис підтверджено" },
    });
  });

  it("позначає 5xx як повторювану помилку", async () => {
    const p = createTurboSmsProvider({
      credentials: creds,
      senderName: "Salon",
      fetchImpl: (async () => new Response("", { status: 503 })) as unknown as typeof fetch,
    });
    const result = await p.send({ to: "+380671234567", text: "x" });
    expect(result).toMatchObject({ ok: false, retryable: true });
  });

  it("не повторює 4xx-помилку авторизації", async () => {
    const p = createTurboSmsProvider({
      credentials: creds,
      senderName: "Salon",
      fetchImpl: (async () => new Response("", { status: 401 })) as unknown as typeof fetch,
    });
    const result = await p.send({ to: "+380671234567", text: "x" });
    expect(result).toMatchObject({ ok: false, retryable: false });
  });
});
