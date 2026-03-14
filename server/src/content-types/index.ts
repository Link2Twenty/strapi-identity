import mfaToken from './mfa';
import mfaTemp from './temp-mfa';
import config from './config';
import emailOtp from './email-otp';

import type { Plugin } from '@strapi/types';

const contentTypes: Plugin.LoadedPlugin['contentTypes'] = {
  'mfa-token': mfaToken as unknown as Plugin.LoadedPlugin['contentTypes']['mfa-token'],
  'mfa-temp': mfaTemp as unknown as Plugin.LoadedPlugin['contentTypes']['mfa-temp'],
  'strapi-identity-config':
    config as unknown as Plugin.LoadedPlugin['contentTypes']['strapi-identity-config'],
  'email-otp': emailOtp as unknown as Plugin.LoadedPlugin['contentTypes']['email-otp'],
};

export default contentTypes;
