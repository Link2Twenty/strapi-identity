import jwt from 'jsonwebtoken';
import { TOTP } from 'otpauth';

import type { Core } from '@strapi/strapi';
import type { Plugin } from '@strapi/types';
import type { Secret } from 'otpauth';

/**
 * Builds the cookie options for the refresh token, taking into account the plugin configuration and whether the request is secure
 * @param secureRequest whether the incoming request is secure (HTTPS)
 * @returns the cookie options to use when setting the refresh token cookie
 */
const getRefreshCookieOptions = (secureRequest?: boolean) => {
  const configuredSecure = strapi.config.get('admin.auth.cookie.secure');
  const isProduction = process.env.NODE_ENV === 'production';

  const domain: string | undefined =
    strapi.config.get('admin.auth.cookie.domain') || strapi.config.get('admin.auth.domain');
  const path: string = strapi.config.get('admin.auth.cookie.path', '/admin');

  const sameSite: boolean | 'lax' | 'strict' | 'none' =
    strapi.config.get('admin.auth.cookie.sameSite') ?? 'lax';

  let isSecure: boolean;
  if (typeof configuredSecure === 'boolean') {
    isSecure = configuredSecure;
  } else if (secureRequest !== undefined) {
    isSecure = isProduction && secureRequest;
  } else {
    isSecure = isProduction;
  }

  return {
    httpOnly: true,
    secure: isSecure,
    overwrite: true,
    domain,
    path,
    sameSite,
    maxAge: undefined,
  };
};

/**
 * Gets the idle and absolute lifespans for a given token type based on the plugin configuration
 * @param type the type of token to get lifespans for ('refresh' or 'session')
 * @returns an object containing the idle and absolute lifespans in seconds for the specified token type
 */
const getLifespansForType = (
  type: 'refresh' | 'session'
): { idleSeconds: number; maxSeconds: number } => {
  if (type === 'refresh') {
    const idleSeconds = Number(
      strapi.config.get('admin.auth.sessions.idleRefreshTokenLifespan', 14 * 24 * 60 * 60)
    );
    const maxSeconds = Number(
      strapi.config.get('admin.auth.sessions.maxRefreshTokenLifespan', 30 * 24 * 60 * 60)
    );

    return { idleSeconds, maxSeconds };
  }

  const idleSeconds = Number(
    strapi.config.get('admin.auth.sessions.idleSessionLifespan', 2 * 60 * 60)
  );
  const maxSeconds = Number(
    strapi.config.get('admin.auth.sessions.maxSessionLifespan', 24 * 60 * 60)
  );

  return { idleSeconds, maxSeconds };
};

/**
 * Builds the cookie options for the refresh token, including the appropriate expiry time based on the plugin configuration and whether the user selected "remember me"
 * @param type the type of token being set ('refresh' or 'session')
 * @param absoluteExpiresAtISO an optional ISO string representing the absolute expiry time of the token, used to ensure the cookie does not outlive the token
 * @param secureRequest whether the incoming request is secure (HTTPS), used to determine the "secure" flag on the cookie if not explicitly configured
 * @returns the cookie options to use when setting the refresh token cookie, including the appropriate expiry time
 */
const buildCookieOptionsWithExpiry = (
  type: 'refresh' | 'session',
  absoluteExpiresAtISO?: string,
  secureRequest?: boolean
) => {
  const base = getRefreshCookieOptions(secureRequest);
  if (type === 'session') return base;

  const { idleSeconds } = getLifespansForType('refresh');
  const now = Date.now();
  const idleExpiry = now + idleSeconds * 1000;
  const absoluteExpiry = absoluteExpiresAtISO
    ? new Date(absoluteExpiresAtISO).getTime()
    : idleExpiry;
  const chosen = new Date(Math.min(idleExpiry, absoluteExpiry));

  return { ...base, expires: chosen, maxAge: Math.max(0, chosen.getTime() - now) };
};

const controller = ({
  strapi,
}: {
  strapi: Core.Strapi;
}): Plugin.LoadedPlugin['controllers'][string] => ({
  async getConfig(ctx) {
    try {
      const config = await strapi.service('plugin::better-auth.config').getConfig();
    } catch (error) {}
  },
  async verify(ctx) {
    const sessionManager = strapi.sessionManager;
    const secret = strapi.config.get<string>('admin.auth.secret');

    // Get the MFA token from the cookie and verify it
    const token = ctx.cookies.get('strapi_admin_mfa');
    const payload = jwt.verify(token, secret) as {
      userId: string;
      deviceId: string;
      rememberMe?: boolean;
    };

    // Get the code from the request body and validate it against the user's active secret and recovery codes
    const body: { code: string } = ctx.request.body;

    try {
      const valid = await strapi
        .service('plugin::better-auth.secret')
        .validateTokenOrRecoveryCode(payload.userId, body.code);

      if (!valid) {
        ctx.status = 400;
        ctx.body = { data: null, error: 'Invalid MFA code' };
        return;
      }

      const { token: refreshToken, absoluteExpiresAt } = await sessionManager(
        'admin'
      ).generateRefreshToken(payload.userId, payload.deviceId, {
        type: payload.rememberMe ? 'refresh' : 'session',
      });

      ctx.cookies.set(
        'strapi_admin_refresh',
        refreshToken,
        buildCookieOptionsWithExpiry(
          payload.rememberMe ? 'refresh' : 'session',
          absoluteExpiresAt,
          ctx.request.secure
        )
      );

      const accessResult = await sessionManager('admin').generateAccessToken(refreshToken);
      const { token: accessToken } = accessResult as { token: string };

      const configuredSecure = strapi.config.get('admin.auth.cookie.secure');
      const isProduction = process.env.NODE_ENV === 'production';
      const isSecure = typeof configuredSecure === 'boolean' ? configuredSecure : isProduction;

      const domain: string | undefined = strapi.config.get('admin.auth.domain');

      ctx.cookies.set('jwtToken', accessToken, {
        httpOnly: false,
        secure: isSecure,
        overwrite: true,
        domain,
      });

      ctx.cookies.set('strapi_admin_mfa', null, { expires: new Date(0) });

      ctx.status = 200;
      ctx.body = {
        data: { token: accessToken, accessToken },
        error: null,
      };
    } catch (error) {
      console.log('Error verifying MFA code:', error);

      ctx.status = 500;
      ctx.body = { data: null, error: 'Server Error' };
    }
  },
  async enable(ctx) {
    const user = ctx.state.user;

    const body: { enable: boolean } = ctx.request.body;
    const service = strapi.service('plugin::better-auth.secret');

    try {
      if (body.enable) {
        const secret: Secret = await service.setupTemporarySecret(user.id);
        const totp = new TOTP({ issuer: 'Strapi', label: user.email, secret });

        ctx.status = 200;
        ctx.body = { data: { uri: totp.toString(), secret: secret.base32 }, error: null };
      } else {
        await service.disableTempSecret(user.id);

        ctx.status = 200;
        ctx.body = { data: { message: 'MFA disabled' }, error: null };
      }
    } catch (error) {
      console.log('Error enabling/disabling MFA:', error);

      ctx.status = 500;
      ctx.body = { data: null, error: 'Failed to update MFA' };
    }
  },
  async setup(ctx) {
    const user = ctx.state.user;

    const body: { code: string } = ctx.request.body;
    const service = strapi.service('plugin::better-auth.secret');

    try {
      const isValid = await service.validateTempToken(user.id, body.code);

      if (!isValid) {
        ctx.status = 400;
        ctx.body = { data: null, error: 'Invalid MFA code' };
        return;
      }

      const codes = await service.setupFullSecret(user.id);

      ctx.status = 200;
      ctx.body = { data: { recoveryCodes: codes }, error: null };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: 'Failed to setup MFA' };
    }
  },
  async checkStatus(ctx) {
    const user = ctx.state.user;
    const service = strapi.service('plugin::better-auth.secret');

    try {
      const isEnabled = await service.isMFAEnabled(user.id);

      ctx.status = 200;
      ctx.body = { data: { status: isEnabled }, error: null };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { data: null, error: 'Failed to check MFA status' };
    }
  },
  async disable(ctx) {
    const user = ctx.state.user;
    const body: { code: string } = ctx.request.body;
    const service = strapi.service('plugin::better-auth.secret');

    try {
      await service.disableSecret(user.id, body.code);

      ctx.status = 200;
      ctx.body = { data: { message: 'MFA disabled' }, error: null };
    } catch (error) {
      console.log('Error disabling MFA:', error);

      ctx.status = 500;
      ctx.body = { data: null, error: 'Failed to disable MFA' };
    }
  },
});

export default controller as unknown as Plugin.LoadedPlugin['controllers'][string];
