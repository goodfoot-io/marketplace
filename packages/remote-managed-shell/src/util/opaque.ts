import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const randomId = (prefix = "id"): string => `${prefix}_${randomBytes(18).toString("base64url")}`;
export const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("base64url");
export function constantTimeTextEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export class CursorCodec {
  private readonly key = randomBytes(32);
  constructor(
    private readonly instance: string,
    private readonly version = 1,
  ) {}
  encode(kind: "output" | "list", session: string, position: number, ceiling = 0): string {
    if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(ceiling) || ceiling < 0)
      throw new RangeError("Cursor positions must be nonnegative safe integers.");
    const body = Buffer.from(
      JSON.stringify([this.version, this.instance, kind, session, position, ceiling, ""]),
      "utf8",
    ).toString("base64url");
    return `${body}.${createHmac("sha256", this.key).update(body).digest("base64url")}`;
  }
  decode(cursor: string, kind: "output" | "list", session: string): { position: number; ceiling: number } | null {
    if (cursor.length > 1024) return null;
    const parts = cursor.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts as [string, string];
    const expected = createHmac("sha256", this.key).update(body).digest("base64url");
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    try {
      const value: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (
        !Array.isArray(value) ||
        value.length !== 7 ||
        value[0] !== this.version ||
        value[1] !== this.instance ||
        value[2] !== kind ||
        value[3] !== session ||
        !Number.isSafeInteger(value[4]) ||
        (value[4] as number) < 0 ||
        !Number.isSafeInteger(value[5]) ||
        (value[5] as number) < 0 ||
        value[6] !== ""
      )
        return null;
      return { position: value[4] as number, ceiling: value[5] as number };
    } catch {
      return null;
    }
  }
}
