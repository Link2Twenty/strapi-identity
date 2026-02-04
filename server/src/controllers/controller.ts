import jwt from 'jsonwebtoken';
import { Secret, TOTP } from 'otpauth';

import type { Core } from '@strapi/strapi';
import type { Plugin } from '@strapi/types';

const controller = ({
  strapi,
}: {
  strapi: Core.Strapi;
}): Plugin.LoadedPlugin['controllers'][string] => ({
  async verify(ctx) {
    const sessionManager = strapi.sessionManager;
    const secret = strapi.config.get<string>('admin.auth.secret');

    const token = ctx.cookies.get('strapi_admin_mfa');
    const payload = jwt.verify(token, secret) as { userId: string; deviceId: string };

    const { token: refreshToken } = await sessionManager('admin').generateRefreshToken(
      payload.userId,
      payload.deviceId,
      {
        type: 'refresh',
      }
    );

    ctx.cookies.set('strapi_admin_refresh', refreshToken);

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
    ctx.body = { data: { message: 'MFA Verified' }, error: null };
  },
  async enable(ctx) {
    const user = ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized' };
      return;
    }

    const body: { enable: boolean } = ctx.request.body;

    try {
      const document = strapi.documents('plugin::better-auth.mfa-temp');

      const field = await document.findFirst({ filters: { admin_user: user.id } });

      // If we're disabling, we can just delete the temp entry and return
      if (!body.enable) {
        if (field) {
          await document.delete({ documentId: field.documentId });
        }
        ctx.status = 200;
        ctx.body = { data: { message: 'MFA status updated' }, error: null };
        return;
      }

      const secret = new Secret({ size: 20 });
      const data = { secret: secret.base32 } as any;

      if (field) {
        await document.update({ documentId: field.documentId, data });
      } else if (body.enable) {
        await document.create({ data: { admin_user: user.id, ...data } });
      }

      const totp = new TOTP({ issuer: 'Strapi', label: user.email, secret });

      ctx.status = 200;
      ctx.body = {
        data: { message: 'MFA status updated', uri: totp.toString(), secret: data.secret },
        error: null,
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: 'Failed to update MFA' };
    }
  },
  async setup(ctx) {
    const user = ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized' };
      return;
    }

    const body: { code: string } = ctx.request.body;

    try {
      const tempDocument = strapi.documents('plugin::better-auth.mfa-temp');
      const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');

      const tempField = await tempDocument.findFirst({ filters: { admin_user: user.id } });
      if (!tempField) {
        ctx.status = 400;
        ctx.body = { error: 'No MFA setup in progress' };
        return;
      }

      const totp = new TOTP({ secret: Secret.fromBase32(tempField.secret) });
      const delta = totp.validate({ token: body.code, window: 1 });

      if (delta === null) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid MFA code' };
        return;
      }

      const existing = await tokenDocument.findFirst({ filters: { admin_user: user.id } });

      // generate 8 recovery codes
      const codes = Array.from({ length: 8 }).map(() =>
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      if (existing) {
        await tokenDocument.update({
          documentId: existing.documentId,
          data: { secret: tempField.secret, enabled: true, recovery_codes: codes } as any,
        });
      } else {
        await tokenDocument.create({
          data: {
            admin_user: user.id,
            secret: tempField.secret,
            enabled: true,
            recovery_codes: codes,
          } as any,
        });
      }

      await tempDocument.delete({ documentId: tempField.documentId });

      ctx.status = 200;
      ctx.body = { data: { message: 'MFA setup complete', recovery_codes: codes }, error: null };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: 'Failed to setup MFA' };
    }
  },
});

export default controller as unknown as Plugin.LoadedPlugin['controllers'][string];
