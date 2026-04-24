import jwt from 'jsonwebtoken';
import { RateLimit } from 'koa2-ratelimit';

import type { Plugin } from '@strapi/types';

const verifyRateLimit: Plugin.LoadedPlugin['middlewares'][string] = (ctx, next) => {
  const secret = strapi.config.get<string>('admin.auth.secret');
  const token = ctx.cookies.get('strapi_admin_mfa');

  // Derive a stable key from userId in the MFA JWT; fall back to IP so the
  // middleware always runs even when the token is absent/malformed
  let prefixKey = ctx.request.ip;
  if (token) {
    try {
      const payload = jwt.verify(token, secret) as { userId: string };
      prefixKey = `mfa-uid-${payload.userId}`;
    } catch {
      // expired / malformed — the policy/controller will reject it; rate-limit by IP
    }
  }

  return RateLimit.middleware({
    interval: { min: 1 }, // 1-minute sliding window
    max: 10,
    prefixKey,
    message: 'Too many attempts. Please try again later.',
    headers: true,
  })(ctx, next);
};

const middlewares: Plugin.LoadedPlugin['middlewares'] = {
  'verify-rate-limit': verifyRateLimit,
};

export default middlewares;
