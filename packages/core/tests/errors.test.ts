import { describe, expect, it } from "vitest";
import { DomainError, addStaff, approveService, changeServicePrice, createService, registerSalon } from "../src";

describe("core: контракт без БД", () => {
  it("DomainError зберігає код і поля", () => {
    const err = new DomainError("Перевірте дані", "validation", { phone: "Некоректний номер" });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("validation");
    expect(err.fields).toEqual({ phone: "Некоректний номер" });
  });

  it("сервісні функції експортовані", () => {
    for (const fn of [addStaff, approveService, changeServicePrice, createService, registerSalon]) {
      expect(typeof fn).toBe("function");
    }
  });
});
