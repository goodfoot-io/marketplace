import { StringDecoder } from "node:string_decoder";
export class Utf8 {
  private readonly decoder = new StringDecoder("utf8");
  invalid = false;
  push(data: Buffer): string {
    const text = this.decoder.write(data);
    if (text.includes("\uFFFD")) this.invalid = true;
    return text;
  }
  end(): string {
    const text = this.decoder.end();
    if (text.includes("\uFFFD")) this.invalid = true;
    return text;
  }
}
export function utf8Prefix(text: string, bytes: number): string {
  const source = Buffer.from(text, "utf8");
  if (source.length <= bytes) return text;
  for (let end = bytes; end > 0; end--) {
    const candidate = source.subarray(0, end).toString("utf8");
    if (!candidate.includes("\uFFFD")) return candidate;
  }
  return "";
}
