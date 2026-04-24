// Types
import type { Core } from '@strapi/strapi';
import type { Plugin } from '@strapi/types';

type controller = Plugin.LoadedPlugin['controllers'][string];

const config = ({ strapi }: { strapi: Core.Strapi }): controller => ({
  async isEnabled(ctx) {
    try {
      const enabled = await strapi.service('plugin::strapi-identity.config').isEnabled();

      ctx.status = 200;
      ctx.body = { data: enabled, error: null };
    } catch (error) {
      strapi.log.error('Error checking if Strapi Identity is enabled');

      ctx.status = 500;
      ctx.body = { data: null, error: 'Server Error' };
    }
  },
  async getConfig(ctx) {
    try {
      const config = await strapi.service('plugin::strapi-identity.config').getConfig();

      ctx.status = 200;
      ctx.body = { data: config, error: null };
    } catch (error) {
      strapi.log.error('Error getting config');

      ctx.status = 500;
      ctx.body = { data: null, error: 'Server Error' };
    }
  },
  async updateConfig(ctx) {
    const body: Partial<{ enabled: boolean; enforce: boolean; issuer: string }> = ctx.request.body;

    try {
      const updatedConfig = await strapi
        .service('plugin::strapi-identity.config')
        .updateConfig(body);

      ctx.status = 200;
      ctx.body = { data: updatedConfig, error: null };
    } catch (error) {
      strapi.log.error('Error updating config');

      ctx.status = 500;
      ctx.body = { data: null, error: 'Server Error' };
    }
  },
});

export default config as unknown as controller;
