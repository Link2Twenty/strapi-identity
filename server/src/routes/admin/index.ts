import admin from './admin.json';
import config from './config.json';
import mfa from './mfa.json';

// Types
import type { Plugin } from '@strapi/types';

const route: Plugin.LoadedPlugin['routes'][string] = () => ({
  type: 'admin',
  routes: [...mfa, ...config, ...admin] as never,
});

export default route;
