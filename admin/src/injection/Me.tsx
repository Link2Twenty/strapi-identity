import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';

import { Box, DesignSystemProvider, Field, Flex } from '@strapi/design-system';
import { Toggle, Typography } from '@strapi/design-system';
import ConfirmModal from '../components/ConfirmModal';
import RemoveModal from '../components/RemoveModal';

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
 * Retrieves the value of a specified cookie.
 *
 * @param name - The name of the cookie to retrieve.
 * @returns The decoded cookie value if found, otherwise null.
 */
export const getCookieValue = (name: string): string | null => {
  let result = null;
  const cookieArray = document.cookie.split(';');
  cookieArray.forEach((cookie) => {
    const [key, value] = cookie.split('=').map((item) => item.trim());
    if (key === name) {
      result = decodeURIComponent(value);
    }
  });
  return result;
};

/**
 * Retrieves the JWT token from localStorage or cookies.
 * @returns The JWT token if found, otherwise null.
 */
const getToken = (): string | null => {
  const fromLocalStorage = localStorage.getItem('jwtToken');
  if (fromLocalStorage) {
    return JSON.parse(fromLocalStorage);
  }

  const fromCookie = getCookieValue('jwtToken');
  return fromCookie ?? null;
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

  const [enabled, setEnabled] = useState<'full' | 'temp' | null>(null);

  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [passcodes, setPasscodes] = useState<string[] | null>(null);

  // Handle the 'system' logic manually
  let finalThemeName = themeName;
  if (themeName === 'system') {
    finalThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const themeObject = strapi.configurations.themes[finalThemeName as 'light' | 'dark'];

  /**
   * Handle toggle of the MFA switch
   * @param event the change event from the toggle switch
   * @param event.target the toggle switch input element containing the new checked state
   */
  const handleToggle = async ({ target }: { target: HTMLInputElement }) => {
    // Get jwtToken from cookies
    const token = getToken();

    const enable = target?.checked || false;

    if (!enable && enabled === 'full') {
      setDisableDialogOpen(true);
      return;
    }

    try {
      const response = await fetch('/better-auth/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ enable }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(`${response.status} - ${body.error || 'Failed to update MFA status'}`);
      }

      const data = body.data;

      if (!data) {
        throw new Error('No data returned from server');
      }

      if (enable) setModalOpen(true);
      setUri(data?.uri || null);
      setSecret(data?.secret || null);
      setEnabled(enable ? 'temp' : null);
    } catch (error) {
      console.error(error);
      setEnabled(null);
    }
  };

  /**
   * Handle confirmation of the MFA setup by validating the provided TOTP code
   * @param e the form submission event containing the TOTP code entered by the user
   */
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const code = formData.get('otp');

    // Get jwtToken from cookies
    const token = getToken();

    try {
      const response = await fetch('/better-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(`${response.status} - ${body.error || 'Failed to set up MFA'}`);
      }

      if (body.data?.recoveryCodes) {
        setPasscodes(body.data.recoveryCodes);
      } else {
        setModalOpen(false);
      }
      setUri(null);
      setSecret(null);
      setEnabled('full');
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Handle closing of the MFA setup modal, resetting all related state to initial values
   */
  const handleClose = () => {
    if (!passcodes) setEnabled(null);

    setModalOpen(false);
    setUri(null);
    setSecret(null);
    setPasscodes(null);
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const code = formData.get('otp');

    // Get jwtToken from cookies
    const token = getToken();

    try {
      const response = await fetch('/better-auth/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(`${response.status} - ${body.error || 'Failed to disable MFA'}`);
      }

      setDisableDialogOpen(false);
      setUri(null);
      setSecret(null);
      setEnabled(null);
    } catch (error) {
      console.error(error);
    }
  };

  // get starting status of MFA for the user
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      const token = getToken();

      try {
        const response = await fetch('/better-auth/status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          signal: ac.signal,
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(`${response.status} - ${body.error || 'Failed to set up MFA'}`);
        }

        setEnabled(body.data?.status || null);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        console.error('Failed to fetch MFA status:', error);
      }
    })();

    return () => ac.abort();
  }, []);

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
              <Toggle
                aria-label="Enable Two-Factor Authentication"
                onLabel="On"
                offLabel="Off"
                checked={enabled !== null}
                onChange={handleToggle}
              />
              <Field.Hint />
            </Field.Root>
          </Flex>
        </Flex>
      </Box>

      <ConfirmModal
        open={modalOpen}
        onOpenChange={handleClose}
        qrCodeUri={uri}
        secret={secret}
        passcodes={passcodes}
        onSubmit={handleConfirm}
      />

      <RemoveModal
        open={disableDialogOpen}
        onOpenChange={setDisableDialogOpen}
        onSubmit={handleDisable}
      />
    </DesignSystemProvider>
  );
};
