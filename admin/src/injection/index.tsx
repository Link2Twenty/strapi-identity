import { createRoot } from 'react-dom/client';
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

// Components
import { IntlProvider } from 'react-intl';
import { DesignSystemProvider } from '@strapi/design-system';

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
let registered: boolean = false;

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
export const InitialInjection = async (strapi: StrapiApp): Promise<void> => {
  const router = strapi.router as unknown as InjectPublicRouter;

  // Wait for the router to be ready
  while (!router?.router?.state?.location) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Subscribe to router changes to re-attach the button when navigating to the login page
  router.router.subscribe((state) => attachRoutes(state, strapi));
  registered = true;

  // Initial attach
  attachRoutes(router.router.state, strapi);
};

const attachRoutes = (state: RouterState, strapi: StrapiApp) => {
  Promise.all(InjectionRoutes.map((options) => attach(state, strapi, options)));
};

/**
 * Wait for the login form to be available in the DOM
 * @returns {Promise<Element>} the injection site element
 */
const getInjectionSite = async (selector: string): Promise<Element> => {
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
const attach = async (
  state: RouterState,
  strapi: StrapiApp,
  options: {
    id: string;
    route: string;
    selector: string;
    Component: () => Promise<{ default: React.ComponentType }>;
  }
): Promise<void> => {
  // Clean up previous injection if any
  const existingContainer = document.querySelector(`#${options.id}`);

  if (!existingContainer) clearRoot();

  if (state.location.pathname !== options.route) return;

  const injectionSite = await getInjectionSite(options.selector);

  // Create the container if it does not exist
  if (!root) {
    const container = document.createElement('div');
    container.id = options.id;
    injectionSite.after(container);
    root = createRoot(container);
  }

  const Component = await options.Component();

  // Render the SSO button
  root.render(
    <Providers store={strapi.store!} configurations={strapi.configurations}>
      <Suspense fallback={null}>
        <Component.default />
      </Suspense>
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

type InjectionRoute = {
  id: string;
  route: string;
  selector: string;
  Component: () => Promise<{
    default: React.ComponentType;
  }>;
};

const InjectionRoutes: InjectionRoute[] = [];

type InjectRouteOptions = {
  id?: string;
  route: string;
  selector: string;
  Component: () => Promise<{
    default: React.ComponentType;
  }>;
};
/**
 * Register an injection route to inject components into specific routes and DOM nodes in the Strapi admin
 * @param options the injection options, including:
 * @param options.id an optional id for the injection route (used for cleanup), if not provided a random id will be generated
 * @param options.route the route to inject into (e.g. '/me')
 * @param options.selector the DOM selector to find the injection site (e.g. '#main-content form[method="put"] > :nth-child(2) > div > div > div:nth-child(2)')
 * @param options.Component the React component to inject
 */
export const registerInjectionRoute = (
  { id, route, selector, Component }: InjectRouteOptions,
  app: StrapiApp
) => {
  if (id && InjectionRoutes.some((r) => r.id === id)) {
    console.warn(`Injection route with id ${id} already exists. Skipping registration.`);
    return;
  }

  // if there is no id, we generate a random dom safe id
  const generatedId = id || `injection-${Math.random().toString(36).substring(2, 9)}`;

  InjectionRoutes.push({ id: generatedId, route, selector, Component });

  if (!registered) InitialInjection(app);
};
