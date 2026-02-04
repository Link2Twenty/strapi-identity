import jwt from 'jsonwebtoken';

import type { Plugin } from '@strapi/types';
import type { Core } from '@strapi/strapi';

const register: Plugin.LoadedPlugin['register'] = ({ strapi }) => {
  const adminPlugin = strapi.admin;
  const secret = strapi.config.get<string>('admin.auth.secret');

  const configuredSecure = strapi.config.get<boolean | undefined>('admin.auth.cookie.secure');
  const isProduction = process.env.NODE_ENV === 'production';
  const isSecure = typeof configuredSecure === 'boolean' ? configuredSecure : isProduction;
  const domain = strapi.config.get<string | undefined>('admin.auth.domain');

  const cookieOptions = { httpOnly: false, secure: isSecure, overwrite: true, domain };

  const loginRoute = adminPlugin.routes.admin.routes.find(
    ({ method, path }) => method === 'POST' && path === '/login'
  );

  if (loginRoute) replaceLogin(loginRoute, secret, cookieOptions);

  strapi.server.use(async (ctx, next) => {
    const mfaCookie = ctx.cookies.get('strapi_admin_mfa');

    // If they have the MFA cookie and try to hit the root admin or dashboard
    if (mfaCookie && ctx.path.startsWith('/admin/auth')) {
      ctx.cookies.set('jwtToken', null, { expires: new Date(0) });
      ctx.redirect('/admin/better-auth/verify');
      return;
    }

    if (!mfaCookie && ctx.path === '/admin/better-auth/verify') {
      ctx.redirect('/admin');
      return;
    }

    await next();
  });
};

/**
 * Replace the login route to set MFA cookie and modify response
 * @param route The route object to modify
 * @param secret The secret key for JWT
 * @param cookieOptions Options for setting cookies
 */
const replaceLogin = (route: Core.Route, secret: string, cookieOptions: Record<string, any>) => {
  route.config.middlewares = route.config.middlewares || [];

  route.config.middlewares.push(async (ctx, next) => {
    const { deviceId, rememberMe } = ctx.request.body as Record<string, any>;

    await next();

    const token: string = ctx.body?.data?.token;

    if (!token) return;

    // decode jwt
    const payload = jwt.verify(token, secret) as { userId: string };

    // check if userId has MFA enabled
    const exists = await strapi.documents('plugin::better-auth.mfa-token').findFirst({
      filters: { admin_user: payload.userId, enabled: true },
    });

    if (!exists) return;

    ctx.res.removeHeader('set-cookie');

    const newPayload = { userId: payload.userId, deviceId, rememberMe, type: 'mfa' };
    const newToken = jwt.sign(newPayload, secret, { expiresIn: '5m' });
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    ctx.cookies.set('strapi_admin_mfa', newToken, { ...cookieOptions, expires });
    ctx.body.data = { data: {}, error: null };
  });
};

export default register;
