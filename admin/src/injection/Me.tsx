import { createRoot } from 'react-dom/client';
import { Box, DesignSystemProvider, Field, Flex, Toggle, Typography } from '@strapi/design-system';

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
  root.render(<MeExtraComponents strapi={strapi} />);
};

const MeExtraComponents = ({ strapi }: { strapi: StrapiApp }) => {
  const state = strapi.store?.getState();
  const themeName = state?.admin_app.theme.currentTheme || 'light';
  const locale = strapi.configurations.locales[0] || 'en';

  // Handle the 'system' logic manually
  let finalThemeName = themeName;
  if (themeName === 'system') {
    finalThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const themeObject = strapi.configurations.themes[finalThemeName as 'light' | 'dark'];

  return (
    <DesignSystemProvider theme={themeObject} locale={locale}>
      <Box
        background="neutral0"
        hasRadius
        shadow="filterShadow"
        paddingTop={6}
        paddingBottom={6}
        paddingLeft={7}
        paddingRight={7}
      >
        <Flex direction="column" alignItems="stretch" gap={4}>
          <Flex direction="column" alignItems="stretch" gap={1}>
            <Typography variant="delta" tag="h2">
              Two-Factor Authentication
            </Typography>
            <Typography>Add an additional layer of security to your account.</Typography>
          </Flex>
          <Flex direction="row" alignItems="stretch" gap={6}>
            <Field.Root name="two-factor-authentication" id="two-factor-authentication">
              <Field.Label>Enable Two-Factor Authentication</Field.Label>
              <Toggle aria-label="Enable Two-Factor Authentication" onLabel="On" offLabel="Off" />
              <Field.Hint />
            </Field.Root>
          </Flex>
        </Flex>
      </Box>
    </DesignSystemProvider>
  );
};
