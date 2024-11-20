import log from "@/log.ts";
import { Context, Next } from "@oak/oak";

export default async function logger(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  log.debug(
    `${ctx.request.method} ${ctx.request.url} - ${ms}ms`,
  );
}
