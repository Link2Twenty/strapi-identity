// Types
import type { Core } from '@strapi/strapi';
import type { Plugin } from '@strapi/types';

type controller = Plugin.LoadedPlugin['controllers'][string];

const config = ({ strapi }: { strapi: Core.Strapi }): controller => ({
  async getConfig(ctx) {
    try {
      const config = await strapi.service('plugin::better-auth.config').getConfig();

      ctx.status = 200;
      ctx.body = { data: config, error: null };
    } catch (error) {
      console.log('Error getting config:', error);

      ctx.status = 500;
      ctx.body = { data: null, error: 'Server Error' };
    }
  },
  async updateConfig(ctx) {
    const body: Partial<{ enabled: boolean; enforce: boolean; issuer: string }> = ctx.request.body;

    try {
      const updatedConfig = await strapi.service('plugin::better-auth.config').updateConfig(body);

      ctx.status = 200;
      ctx.body = { data: updatedConfig, error: null };
    } catch (error) {
      console.log('Error updating config:', error);

      ctx.status = 500;
      ctx.body = { data: null, error: 'Server Error' };
    }
  },
});

export default config as unknown as controller;
