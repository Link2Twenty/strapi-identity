import { createRoot } from 'react-dom/client';
import { useState } from 'react';

import { Box, Button, DesignSystemProvider, Field, Flex } from '@strapi/design-system';
import { Modal, Toggle, Typography } from '@strapi/design-system';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../components/InputOTP';
import QRCode from 'react-qr-code';

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

  const [enabled, setEnabled] = useState<boolean>(false);
  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Handle the 'system' logic manually
  let finalThemeName = themeName;
  if (themeName === 'system') {
    finalThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const themeObject = strapi.configurations.themes[finalThemeName as 'light' | 'dark'];

  const handleToggle = async ({ target }: { target: HTMLInputElement }) => {
    // Get jwtToken from cookies
    const token = getToken();

    const enable = target?.checked || false;

    try {
      const reponse = await fetch('/better-auth/enable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ enable }),
      }).then((res) => res.json());

      const data = reponse.data;

      if (enable) setModalOpen(true);
      setUri(data?.uri || null);
      setSecret(data?.secret || null);
    } catch (error) {
      console.error(error);
    } finally {
      setEnabled(enable);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const code = formData.get('otp');

    // Get jwtToken from cookies
    const token = getToken();

    try {
      const reponse = await fetch('/better-auth/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      }).then((res) => res.json());

      const data = reponse.data;

      console.log(data.recovery_codes);

      setModalOpen(false);
      setUri(null);
      setSecret(null);
    } catch (error) {
      console.error(error);
    } finally {
    }
  };

  const handleClose = () => {
    setModalOpen(false);
    setUri(null);
    setSecret(null);
    setEnabled(false);
  };

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
                checked={enabled}
                onChange={handleToggle}
              />
              <Field.Hint />
            </Field.Root>
            <Modal.Root open={modalOpen} onOpenChange={handleClose}>
              <Modal.Content>
                <form onSubmit={handleConfirm}>
                  <Modal.Header>
                    <Modal.Title>Set up Two-Factor Authentication</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <Flex
                      direction="column"
                      alignItems="center"
                      gap={4}
                      marginTop={4}
                      marginBottom={4}
                    >
                      <Typography>
                        You will need an authenticator app to scan the QR code below.
                      </Typography>
                      <QRCode value={uri || ''} />
                      {secret && <Typography variant="pi">{secret || ''}</Typography>}
                    </Flex>
                    <hr
                      style={{
                        height: '1px',
                        border: '0',
                        backgroundColor: '#e5e5e5',
                      }}
                    />
                    <Flex
                      direction="column"
                      alignItems="center"
                      gap={4}
                      marginTop={4}
                      marginBottom={4}
                    >
                      <Typography>
                        You will need an authenticator app to scan the QR code below.
                      </Typography>
                      <InputOTP maxLength={6} name="otp" id="otp">
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </Flex>
                  </Modal.Body>
                  <Modal.Footer>
                    <Modal.Close>
                      <Button variant="tertiary">Cancel</Button>
                    </Modal.Close>
                    <Button type="submit">Confirm</Button>
                  </Modal.Footer>
                </form>
              </Modal.Content>
            </Modal.Root>
          </Flex>
        </Flex>
      </Box>
    </DesignSystemProvider>
  );
};
