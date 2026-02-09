import * as secret from './mfa';
import * as config from './config';

import type { Plugin } from '@strapi/types';

const services: Plugin.LoadedPlugin['services'] = { secret, config };

export default services;
