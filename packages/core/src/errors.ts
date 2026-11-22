/** Помилка бізнес-правила, яку можна показати користувачу. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code:
      | "validation"
      | "forbidden"
      | "conflict"
      | "limit_reached" = "validation",
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
