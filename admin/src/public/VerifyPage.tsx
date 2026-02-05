import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../components/InputOTP';
import { Box, Button, Flex, Link, Main } from '@strapi/design-system';
import { SingleSelect, SingleSelectOption, Typography } from '@strapi/design-system';
import { RESPONSIVE_DEFAULT_SPACING, useAuth } from '@strapi/strapi/admin';

// Types
import type { StrapiApp } from '@strapi/strapi/admin';
import type { RouteObject } from 'react-router-dom';

export interface InjectPublicRouter extends Omit<StrapiApp['router'], 'router'> {
  router: { routes: RouteObject[] };
}

/**
 * Inject the verify page route into the Strapi router
 * @param router StrapiApp router instance
 */
export const InjectVerify = async (app: StrapiApp) => {
  const _router = app.router as unknown as InjectPublicRouter;

  // Wait for the router to be initialized
  while (!_router.router) await new Promise((resolve) => setTimeout(resolve, 10));

  _router.router.routes?.[0].children?.unshift({
    path: 'better-auth/verify',
    element: <VerifyPage fallbackIcon={app.configurations?.authLogo || ''} />,
  });
};

const Wrapper = styled(Box)`
  margin: 0 auto;
  width: 100%;
  max-width: 55.2rem;
`;

const LocaleToggle = () => {
  return (
    <SingleSelect aria-label={'Select interface language'} value={'en'} onChange={() => {}}>
      {Object.entries({ en: 'English' }).map(([language, name]) => (
        <SingleSelectOption key={language} value={language}>
          {name}
        </SingleSelectOption>
      ))}
    </SingleSelect>
  );
};

const Img = styled.img`
  height: 7.2rem;
`;

const Logo = ({ fallbackIcon }: { fallbackIcon: string }) => {
  const [icon, setIcon] = useState<string | null>(null);

  // Get the icon from the backend
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const response = await fetch('/admin/init', { signal: ac.signal });

        if (!response.ok) {
          throw new Error(`Failed to fetch icon: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setIcon(data.data.authLogo || fallbackIcon);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Fetch was aborted, no need to do anything
          return;
        }

        setIcon(fallbackIcon);
      }
    })();
  }, [fallbackIcon]);

  return <Img src={icon || ''} aria-hidden alt="" />;
};

const VerifyPage = ({ fallbackIcon }: { fallbackIcon: string }) => {
  const { token } = useAuth('MFA', (auth) => auth);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const code = formData.get('code');

    try {
      const response = await fetch('/better-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}: ${data.error || 'Unknown error'}`
        );
      }

      const target = new URLSearchParams(window.location.search).get('redirectTo') || '/admin';
      window.location.replace(target);
    } catch (error) {
      console.error('Error verifying MFA code:', error);
    }
  };

  // Redirect to admin if no MFA token is present
  useEffect(() => {
    const mfaToken = document.cookie.split('; ').reduce<string | null>((acc, cookie) => {
      const [name, value] = cookie.split('=');

      return name === 'strapi_admin_mfa' ? value.trim() : acc;
    }, null);

    if (token || !mfaToken) window.location.replace('/admin');
  }, [token]);

  return (
    <div>
      <Flex tag="header" justifyContent="flex-end">
        <Box paddingTop={6} paddingRight={RESPONSIVE_DEFAULT_SPACING}>
          <LocaleToggle />
        </Box>
      </Flex>

      <Box
        paddingTop={2}
        paddingBottom={RESPONSIVE_DEFAULT_SPACING}
        marginLeft={RESPONSIVE_DEFAULT_SPACING}
        marginRight={RESPONSIVE_DEFAULT_SPACING}
      >
        <Main>
          <Wrapper
            shadow="tableShadow"
            hasRadius
            paddingTop={RESPONSIVE_DEFAULT_SPACING}
            paddingBottom={RESPONSIVE_DEFAULT_SPACING}
            paddingLeft={RESPONSIVE_DEFAULT_SPACING}
            paddingRight={RESPONSIVE_DEFAULT_SPACING}
            background="neutral0"
          >
            <Flex direction="column">
              <Logo fallbackIcon={fallbackIcon} />

              <Box paddingTop={6} paddingBottom={1}>
                <Typography variant="alpha" tag="h1" textAlign="center">
                  Verify Your Identity
                </Typography>
              </Box>

              <Box paddingBottom={7}>
                <Typography
                  variant="epsilon"
                  textColor="neutral600"
                  textAlign="center"
                  display="block"
                >
                  Enter your verification code to continue.
                </Typography>
              </Box>
            </Flex>

            <Box>
              <form onSubmit={handleSubmit}>
                <Flex direction="column" alignItems="stretch" gap={6}>
                  <InputOTP maxLength={6} name="code" id="code">
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
                  <Button fullWidth size="L" variant="primary" style={{ height: '3.2rem' }}>
                    Submit Code
                  </Button>
                </Flex>
              </form>
            </Box>
          </Wrapper>

          <Flex justifyContent="center">
            <Box paddingTop={4}>
              <Link isExternal={false} to="#">
                Resend Code
              </Link>
            </Box>
          </Flex>
        </Main>
      </Box>
    </div>
  );
};
