export default async function globalTeardown() {
  const pg = globalThis.__EMBEDDED_PG__;
  if (pg) {
    await pg.stop();
    globalThis.__EMBEDDED_PG__ = undefined;
  }
}
