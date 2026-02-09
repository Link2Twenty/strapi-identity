import controller from './controller';
import config from './config';

import type { Plugin } from '@strapi/strapi';

const controllers: Plugin.LoadedPlugin['controllers'] = {
  controller,
  config,
};

export default controllers;
