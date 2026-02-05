import { useEffect } from 'react';
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
export const InjectVerify = async (router: Omit<StrapiApp['router'], 'router'>) => {
  const _router = router as InjectPublicRouter;

  // Wait for the router to be initialized
  while (!_router.router) await new Promise((resolve) => setTimeout(resolve, 10));

  _router.router.routes?.[0].children?.unshift({
    path: 'better-auth/verify',
    element: <VerifyPage />,
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

const Logo = () => {
  return (
    <Img
      src={
        "data:image/svg+xml,%3csvg width='800' height='800' viewBox='0 0 800 800' fill='none' xmlns='http://www.w3.org/2000/svg'%3e %3cpath d='M39 282c0-118 0-176.9 36.6-213.5C112.2 32 171.1 32 288.9 32h221.2c117.8 0 176.7 0 213.3 36.6C760 105.2 760 164.1 760 281.9v221.2c0 117.8 0 176.7-36.6 213.3C686.8 753 627.9 753 510.1 753H288.9c-117.8 0-176.7 0-213.3-36.6C39 679.8 39 620.9 39 503.1V281.9Z' fill='%234945FF'/%3e %3cpath fill-rule='evenodd' clip-rule='evenodd' d='M536.4 250.7H293.7v123.8h123.8v123.7h123.8V255.5c0-2.6-2.2-4.8-4.9-4.8Z' fill='white'/%3e %3cpath fill='white' d='M412.7 374.5h4.8v4.8h-4.8z'/%3e %3cpath d='M293.8 374.5h119c2.6 0 4.8 2.1 4.8 4.8v119h-119a4.8 4.8 0 0 1-4.8-4.9v-119Z' fill='%239593FF'/%3e %3cpath d='M417.5 498.2h123.8L421.6 618a2.4 2.4 0 0 1-4-1.7v-118ZM293.8 374.5h-118a2.4 2.4 0 0 1-1.7-4.1l119.7-119.7v123.8Z' fill='%239593FF'/%3e%3c/svg%3e"
      }
      aria-hidden
      alt=""
    />
  );
};

const VerifyPage = () => {
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
              <Logo />

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
