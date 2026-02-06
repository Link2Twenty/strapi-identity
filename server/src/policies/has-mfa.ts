import jwt from 'jsonwebtoken';

import type { Plugin } from '@strapi/types';

const policy: Plugin.LoadedPlugin['policies'][string] = (policyContext, _, { strapi }) => {
  const cookieHeader = String(policyContext.request?.header?.cookie || '');
  const secret = strapi.config.get<string>('admin.auth.secret');

  const mfaCookie = cookieHeader.split('; ').reduce<string | null>((acc, curr) => {
    const [key, value] = curr.split('=');

    return key === 'strapi_admin_mfa' ? value : acc;
  }, null);

  if (!mfaCookie) return false;

  try {
    jwt.verify(mfaCookie || '', secret);

    return true;
  } catch (e) {
    return false;
  }
};

export default policy;
