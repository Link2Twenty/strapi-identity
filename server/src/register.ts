import jwt from 'jsonwebtoken';

import type { Plugin } from '@strapi/types';
import type { Core } from '@strapi/strapi';

const register: Plugin.LoadedPlugin['register'] = ({ strapi }) => {
  const { admin, config, server } = strapi;

  registerMiddlewares(server);

  const secret = config.get<string>('admin.auth.secret');
  const domain = config.get<string | undefined>('admin.auth.domain');
  const loginRoute = admin.routes.admin.routes.find(
    ({ method, path }) => method === 'POST' && path === '/login'
  );

  if (loginRoute) replaceLogin(loginRoute, secret, domain);
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

    const secure: boolean =
      strapi.config.get('admin.auth.cookie.secure') ?? process.env.NODE_ENV === 'production';

    const opt = { domain, httpOnly: true, overwrite: true, secure, expires };
    ctx.cookies.set('strapi_admin_mfa', newToken, opt);
    ctx.body.data = { data: {}, error: null };
  });
};

/**
 * Register middlewares for handling MFA cookie and redirects
 * @param server The Strapi server instance
 */
const registerMiddlewares = (server: Core.Strapi['server']) => {
  const configService = strapi.service('plugin::strapi-identity.config');

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

  server.use(async (ctx, next) => {
    const cookie = ctx.cookies.get('jwtToken');

    // If we're not signed in, do nothing
    if (!cookie) {
      await next();
      return;
    }

    const config = await configService.getConfig();

    // If MFA is not enabled or enforced, do nothing
    if (!config.enabled || !config.enforce) {
      await next();
      return;
    }

    const userEnabled = await configService.checkUserByJWT(cookie);

    // User already has MFA — let them through
    if (userEnabled) {
      // If they're trying to access the enforced page, redirect them to the main admin page
      if (ctx.path === '/admin/strapi-identity/enforced') {
        ctx.redirect('/admin');
        return;
      }

      await next();
      return;
    }

    // User is logged in, enforce is on, and MFA is not set up.
    // Allow only the paths required to load the enforced page and set up MFA.
    const allowedPaths = [
      '/admin/strapi-identity/enforced',
      '/admin/init',
      '/admin/users/me',
      '/strapi-identity/status',
      '/strapi-identity/config',
      '/strapi-identity/enable',
      '/strapi-identity/setup',
      '/strapi-identity/enable-email',
      '/strapi-identity/setup-email',
    ];

    const isAllowed =
      allowedPaths.includes(ctx.path) ||
      // Static assets (JS, CSS, images, fonts, sourcemaps)
      /\.(mjs|js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?.*)?$/.test(ctx.path) ||
      ctx.path.startsWith('/admin/@') ||
      ctx.path.startsWith('/admin/src/');

    if (!isAllowed) console.log(ctx.path);

    if (!isAllowed) {
      // HTML navigation → redirect to the enforced page
      if (ctx.accepts('html') && ctx.path.startsWith('/admin')) {
        ctx.redirect('/admin/strapi-identity/enforced');
        return;
      }

      // API / JSON requests → block with 403
      ctx.status = 403;
      ctx.body = { error: { status: 403, message: 'MFA setup required.' } };
      return;
    }

    await next();
  });
};

export default register;
