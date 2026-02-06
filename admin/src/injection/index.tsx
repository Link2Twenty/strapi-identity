import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

// Components
import { IntlProvider } from 'react-intl';
import { DesignSystemProvider } from '@strapi/design-system';
import { ProfileToggle } from './ProfileToggle';

// Helpers
import defaultsDeep from 'lodash/defaultsDeep';

// Types
import type { Root } from 'react-dom/client';
import type { Router as RemixRouter, RouterState } from '@remix-run/router';
import type { StrapiApp } from '@strapi/strapi/admin';

export interface InjectPublicRouter extends Omit<StrapiApp['router'], 'router'> {
  router: RemixRouter;
}

let root: Root | null = null;

/**
 * Clear the SSO button from the login page
 */
const clearRoot = () => {
  if (!root) return;

  root.unmount();
  root = null;
};

/**
 * Inject extra components into the Me page
 * @param router the Strapi admin app
 */
export const InjectMe = async (strapi: StrapiApp): Promise<void> => {
  const router = strapi.router as unknown as InjectPublicRouter;

  // Wait for the router to be ready
  while (!router?.router?.state?.location) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Subscribe to router changes to re-attach the button when navigating to the login page
  router.router.subscribe((state) => attach(state, strapi));

  // Initial attach
  attach(router.router.state, strapi);
};

/**
 * Wait for the login form to be available in the DOM
 * @returns {Promise<Element>} the injection site element
 */
const getInjectionSite = async (): Promise<Element> => {
  const selector =
    '#main-content form[method="put"] > :nth-child(2) > div > div > div:nth-child(2)';
  let injectionSite = document.querySelector(selector);

  // Wait until the login form is available
  while (!injectionSite) {
    await new Promise((resolve) => setTimeout(resolve, 10));

    injectionSite = document.querySelector(selector);
  }

  return injectionSite;
};

/**
 * Attach the SSO button to the login page
 * @param {RouterState} state the router state
 */
const attach = async (state: RouterState, strapi: StrapiApp): Promise<void> => {
  // Clean up previous injection if any
  const existingContainer = document.querySelector('#me-injection-point');

  if (!existingContainer) clearRoot();

  if (state.location.pathname !== '/admin/me') return;

  const injectionSite = await getInjectionSite();

  // Create the container if it does not exist
  if (!root) {
    const container = document.createElement('div');
    container.id = 'me-injection-point';
    injectionSite.after(container);
    root = createRoot(container);
  }

  // Render the SSO button
  root.render(
    <Providers store={strapi.store!} configurations={strapi.configurations}>
      <ProfileToggle />
    </Providers>
  );
};

type ProvidersProps = {
  children: React.ReactNode;
  store: NonNullable<StrapiApp['store']>;
  configurations: StrapiApp['configurations'];
};

/**
 * Providers component to wrap the injected components with necessary context providers (e.g. DesignSystemProvider, IntlProvider)
 */
const Providers = ({ children, store, configurations }: ProvidersProps) => {
  const state = useSyncExternalStore(store.subscribe, store.getState);

  const themeName = state.admin_app.theme.currentTheme || 'light';
  const locale = state.admin_app.language.locale || 'en';
  const translations: Record<string, Record<string, string>> = configurations.translations || {};

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  // Listen to system theme changes
  useEffect(() => {
    const ac = new AbortController();
    const mediaQuery = matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener(
      'change',
      (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      },
      { signal: ac.signal }
    );

    return () => ac.abort();
  }, []);

  const appMessages = useMemo(
    () => defaultsDeep(translations[locale], translations.en),
    [locale, translations]
  );

  const themeObject = useMemo(() => {
    return configurations.themes[themeName === 'system' ? systemTheme : themeName];
  }, [themeName, systemTheme, configurations.themes]);

  return (
    <DesignSystemProvider theme={themeObject} locale={locale}>
      <IntlProvider locale={locale} messages={appMessages}>
        {children}
      </IntlProvider>
    </DesignSystemProvider>
  );
};
