import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { InjectVerify } from './public/VerifyPage';
import { initialiseInjections } from 'strapi-admin-portal';

// Types
import type { StrapiApp } from '@strapi/strapi/admin';
import type { Middleware } from '@reduxjs/toolkit';
import type { Store } from '@strapi/admin/strapi-admin';

const plugin: StrapiApp['appPlugins'][string] = {
  register(app) {
    // Register the plugin in the Strapi admin
    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });

    // Register settings link
    app.addSettingsLink('global', {
      intlLabel: {
        id: getTranslation('plugin.name'),
        defaultMessage: 'Better Auth Settings',
      },
      id: 'better-auth-settings',
      to: `/settings/${PLUGIN_ID}`,
      Component: async () => import('./settings/SettingsPage'),
      permissions: [
        { action: 'plugin::better-auth.settings.read' },
        { action: 'plugin::better-auth.settings.read' },
      ],
    });

    // Register middlewares
    app.addMiddlewares([mfaRedirect]);

    // Register injections
    const injections = initialiseInjections(app);

    injections.registerRoute({
      id: 'profile-toggle',
      route: '/admin/me',
      selector: '#main-content form[method="put"] > :nth-child(2) > div > div > div:nth-child(2)',
      Component: async () => import('./injection/ProfileToggle'),
    });

    injections.registerRoute({
      id: 'admin-reset',
      route: '/admin/settings/users/:id',
      selector: '#main-content form[method="put"] > :nth-child(2) > div > div:nth-child(2)',
      Component: async () =>
        import('./injection/AdminReset') as Promise<{
          default: React.ComponentType<unknown>;
        }>,
    });

    InjectVerify(app);
  },

  registerTrads({ locales }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(`./translations/${locale}.json`)) as {
            default: Record<string, string>;
          };

          const newData: Record<string, string> = {};
          const keys = Object.keys(data);

          for (const key of keys) {
            newData[getTranslation(key)] = data[key];
          }

          return { data: newData, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

/**
 * Middleware to redirect to MFA verify page after login if no token is present
 */
const mfaRedirect: () => Middleware<object, ReturnType<Store['getState']>> = () => {
  return () => (next) => (action) => {
    // If the action is admin/login and token is undefined, redirect to verify page
    if (
      action &&
      action.type === 'admin/login' &&
      (action.payload || {}).hasOwnProperty('token') &&
      action.payload.token === undefined
    ) {
      window.location.replace('/admin/better-auth/verify');
      return;
    }

    // action is not the one we want to override
    return next(action);
  };
};

export default plugin;
