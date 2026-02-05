import * as secret from './mfa';

import type { Plugin } from '@strapi/types';

const services: Plugin.LoadedPlugin['services'] = { secret };

export default services;
