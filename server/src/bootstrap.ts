import type { Plugin } from '@strapi/types';

const bootstrap: Plugin.LoadedPlugin['bootstrap'] = async () => {
  const config = strapi.documents('plugin::better-auth.better-auth-config');
  const existingConfig = await config.count({});

  // If no configuration exists, create a default one
  if (!existingConfig) {
    await config.create({ data: { enabled: false, enforce: false, issuer: 'Strapi' } });
  }

  // Register permissions
  strapi.admin.services.permission.actionProvider.registerMany([
    {
      uid: 'settings.read',
      section: 'plugins',
      displayName: 'Read',
      subCategory: 'settings',
      pluginName: 'better-auth',
    },
    {
      uid: 'settings.update',
      section: 'plugins',
      displayName: 'Update',
      subCategory: 'settings',
      pluginName: 'better-auth',
    },
  ]);
};

export default bootstrap;
