import jwt from 'jsonwebtoken';

import type { Plugin } from '@strapi/types';
import type { Core } from '@strapi/strapi';

const register: Plugin.LoadedPlugin['register'] = ({ strapi }) => {
  const { admin, config, server } = strapi;

  const secret = config.get<string>('admin.auth.secret');
  const domain = config.get<string | undefined>('admin.auth.domain');
  const loginRoute = admin.routes.admin.routes.find(
    ({ method, path }) => method === 'POST' && path === '/login'
  );

  if (loginRoute) replaceLogin(loginRoute, secret, domain);

  server.use(async (ctx, next) => {
    const mfaCookie = ctx.cookies.get('strapi_admin_mfa');

    // If they have the MFA cookie and try to hit the root admin or dashboard
    if (mfaCookie && ctx.path.startsWith('/admin/auth')) {
      ctx.cookies.set('jwtToken', null, { expires: new Date(0) });
      ctx.redirect('/admin/strapi-identity/verify');
      return;
    }

    if (!mfaCookie && ctx.path === '/admin/strapi-identity/verify') {
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
const replaceLogin = (route: Core.Route, secret: string, domain: string | undefined) => {
  route.config.middlewares = route.config.middlewares || [];

  route.config.middlewares.push(async (ctx, next) => {
    const { deviceId, rememberMe } = ctx.request.body as Record<string, any>;

    await next();

    // If login was unsuccessful, do nothing
    const token: string = ctx.body?.data?.token;

    if (!token) return;

    // If we're not enabling MFA, do nothing
    const config: { enabled: boolean; enforce: boolean; issuer: string } = await strapi
      .service('plugin::strapi-identity.config')
      .getConfig();

    if (!config.enabled) return;

    // decode jwt
    const payload = jwt.verify(token, secret) as { userId: string };

    // check if userId has MFA enabled
    const exists = await strapi.documents('plugin::strapi-identity.mfa-token').findFirst({
      filters: { admin_user: { id: payload.userId }, enabled: true },
    });

    if (!exists) return;

    // If the user has email OTP enabled, generate and send the OTP now
    if (exists.type === 'email') {
      try {
        const adminUser = await strapi.db
          .query('admin::user')
          .findOne({ where: { id: Number(payload.userId) }, select: ['email'] });

        if (adminUser?.email) {
          const otp = await strapi
            .service('plugin::strapi-identity.secret')
            .generateEmailOTP(payload.userId, 'login');

          await strapi.service('plugin::strapi-identity.email').send(adminUser.email, otp);
        }
      } catch (err) {
        console.log('Error sending login email OTP:', err);
      }
    }

    ctx.res.removeHeader('set-cookie');

    const newPayload = {
      userId: payload.userId,
      deviceId,
      rememberMe,
      type: 'mfa',
      mfaType: exists.type,
    };
    const newToken = jwt.sign(newPayload, secret, { expiresIn: '5m' });
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const opt = { domain, httpOnly: false, overwrite: true, secure: ctx.request.secure, expires };
    ctx.cookies.set('strapi_admin_mfa', newToken, opt);
    ctx.body.data = { data: {}, error: null };
  });
};

export default register;
