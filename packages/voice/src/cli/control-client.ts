/**
 * HTTP client for talking to the rvs control server (port+1).
 */

import http from "node:http";

export interface ControlClientOptions {
  controlPort: number;
}

function request(
  options: http.RequestOptions,
  body?: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        reject(new Error(`Daemon not running on port ${options.port ?? ""} (ECONNREFUSED)`));
      } else {
        reject(new Error(err.message || err.code || String(err)));
      }
    });
    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}

function makeOptions(
  controlPort: number,
  method: string,
  path: string,
  bodyLength?: number,
): http.RequestOptions {
  const opts: http.RequestOptions = {
    hostname: "localhost",
    port: controlPort,
    path,
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (bodyLength !== undefined) {
    (opts.headers as Record<string, string | number>)["Content-Length"] = bodyLength;
  }
  return opts;
}

export async function getStatus(controlPort: number): Promise<{ statusCode: number; body: string }> {
  return request(makeOptions(controlPort, "GET", "/status"));
}

export async function postJson(
  controlPort: number,
  path: string,
  data: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  const body = JSON.stringify(data);
  return request(makeOptions(controlPort, "POST", path, Buffer.byteLength(body)), body);
}

export async function postEmpty(
  controlPort: number,
  path: string,
): Promise<{ statusCode: number; body: string }> {
  const body = "{}";
  return request(makeOptions(controlPort, "POST", path, Buffer.byteLength(body)), body);
}

/**
 * GET /watch with query params, returns raw body text (JSONL).
 */
export async function watchOnce(
  controlPort: number,
  events: string[],
  after: number,
): Promise<{ statusCode: number; body: string }> {
  const eventsParam = events.length > 0 ? `events=${encodeURIComponent(events.join(","))}&` : "";
  const path = `/watch?${eventsParam}after=${after}`;
  return request(makeOptions(controlPort, "GET", path));
}
