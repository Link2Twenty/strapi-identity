import type { Plugin } from '@strapi/types';

const route = (): Plugin.LoadedPlugin['routes']['admin'] => ({
  type: 'admin',
  routes: [
    {
      method: 'POST',
      path: '/verify',
      handler: 'controller.verify',
      info: { apiName: 'verify', pluginName: 'better-auth', type: 'content-api' },
      config: {
        auth: false,
        policies: ['has-mfa'],
      },
    },
    {
      method: 'POST',
      path: '/enable',
      handler: 'controller.enable',
      info: { apiName: 'enable', pluginName: 'better-auth', type: 'content-api' },
      config: {},
    },
    {
      method: 'POST',
      path: '/setup',
      handler: 'controller.setup',
      info: { apiName: 'setup', pluginName: 'better-auth', type: 'content-api' },
      config: {},
    },
    {
      method: 'POST',
      path: '/disable',
      handler: 'controller.disable',
      info: { apiName: 'disable', pluginName: 'better-auth', type: 'content-api' },
      config: {},
    },
    {
      method: 'GET',
      path: '/status',
      handler: 'controller.checkStatus',
      info: { apiName: 'checkStatus', pluginName: 'better-auth', type: 'content-api' },
      config: {},
    },
    {
      method: 'GET',
      path: '/config',
      handler: 'config.getConfig',
      info: { apiName: 'getConfig', pluginName: 'better-auth', type: 'content-api' },
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'POST',
      path: '/config',
      handler: 'config.updateConfig',
      info: { apiName: 'updateConfig', pluginName: 'better-auth', type: 'content-api' },
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::better-auth.settings.update'] },
          },
        ],
      },
    },
  ],
});

export default route as unknown as Plugin.LoadedPlugin['routes']['admin'];
