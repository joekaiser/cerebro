import { Context, isHttpError, Next, Status } from "@oak/oak";
import { isProduction } from "@/config.ts";

export default async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      ctx.response.status = err.status;

      ctx.response.body = {
        error: isProduction() ? "Interna Server Error" : err.message,
      };
    } else {
      ctx.response.status = Status.InternalServerError;
      ctx.response.body = {
        error: isProduction() ? "Internal Server Error" : err,
      };
    }
  }
}
