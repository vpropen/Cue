import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  normalizeUaPhone,
  validateSalonRegistrationContact,
} from "./contact";

describe("normalizeUaPhone", () => {
  it.each([
    ["+380 67 123 45 67", "+380671234567"],
    ["380671234567", "+380671234567"],
    ["0671234567", "+380671234567"],
    ["+38 (067) 123-45-67", "+380671234567"],
  ])("нормалізує %s", (input, expected) => {
    expect(normalizeUaPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+1 202 555 0100", "+380 0 123 45 67", "067123456", "+38067123456789"])(
    "відхиляє %s",
    (input) => {
      expect(normalizeUaPhone(input)).toBeNull();
    },
  );
});

describe("isValidEmail", () => {
  it("приймає коректні адреси", () => {
    expect(isValidEmail("owner@salon.ua")).toBe(true);
  });
  it("відхиляє некоректні адреси", () => {
    expect(isValidEmail("owner@")).toBe(false);
    expect(isValidEmail("owner salon.ua")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validateSalonRegistrationContact", () => {
  it("вимагає і телефон, і email", () => {
    const result = validateSalonRegistrationContact({ phone: "", email: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.phone).toBeDefined();
      expect(result.errors.email).toBeDefined();
    }
  });

  it("повертає нормалізовані значення (email у нижньому регістрі)", () => {
    const result = validateSalonRegistrationContact({
      phone: "067 123 45 67",
      email: " Owner@Salon.UA ",
    });
    expect(result).toEqual({
      ok: true,
      value: { phone: "+380671234567", email: "owner@salon.ua" },
    });
  });
});
