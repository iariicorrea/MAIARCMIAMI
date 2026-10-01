// Cloudflare Pages: las rutas /api/* usan el mismo servidor del panel que src/worker.js.
import worker from '../../src/worker.js';
export const onRequest = (ctx) => worker.fetch(ctx.request, ctx.env);
