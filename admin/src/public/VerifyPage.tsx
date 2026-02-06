import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

// Components
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../components/InputOTP';
import { Box, Button, Flex, Main } from '@strapi/design-system';
import { SingleSelect, SingleSelectOption, TextInput, Typography } from '@strapi/design-system';
import { RESPONSIVE_DEFAULT_SPACING, useAuth } from '@strapi/strapi/admin';

// Helpers
import { getTranslation } from '../utils/getTranslation';

// Hooks
import { useIntl } from 'react-intl';

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
  const { formatMessage, locale } = useIntl();
  const localeNames: Record<string, string> = useSelector(
    (state: any) => state.admin_app.language.localeNames
  );
  const dispatch = useDispatch();

  return (
    <SingleSelect
      aria-label={formatMessage({
        id: 'global.localeToggle.label',
        defaultMessage: 'Select interface language',
      })}
      value={locale}
      onChange={(language: string) => dispatch({ type: 'admin/setLocale', payload: language })}
    >
      {Object.entries(localeNames).map(([language, name]) => (
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
  const auth = useAuth('MFA', (auth) => auth);
  const { formatMessage } = useIntl();

  const [error, setError] = useState<string | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

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
      setError(
        formatMessage({
          id: getTranslation('verify_page.error'),
          defaultMessage: 'Invalid code. Please try again.',
        })
      );
      (event.currentTarget as HTMLFormElement).reset();
    }
  };

  // Redirect to admin if no MFA token is present
  useEffect(() => {
    const mfaToken = document.cookie.split('; ').reduce<string | null>((acc, cookie) => {
      const [name, value] = cookie.split('=');

      return name === 'strapi_admin_mfa' ? value.trim() : acc;
    }, null);

    if (auth?.token || !mfaToken) window.location.replace('/admin');
  }, [auth?.token]);

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
                  {formatMessage({
                    id: getTranslation('verify_page.title'),
                    defaultMessage: 'Verify Your Identity',
                  })}
                </Typography>
              </Box>

              <Box paddingBottom={7}>
                <Typography
                  variant="epsilon"
                  textColor="neutral600"
                  textAlign="center"
                  display="block"
                >
                  {formatMessage({
                    id: getTranslation('verify_page.subtitle'),
                    defaultMessage: 'Enter your verification code to continue.',
                  })}
                </Typography>
              </Box>
            </Flex>

            <Box>
              <form onSubmit={handleSubmit}>
                <Flex direction="column" alignItems="stretch" gap={6}>
                  {error ? (
                    <Typography role="alert" tabIndex={-1} textColor="danger600" textAlign="center">
                      {error}
                    </Typography>
                  ) : null}
                  {useRecoveryCode ? (
                    <TextInput name="code" id="code" autoFocus />
                  ) : (
                    <InputOTP maxLength={6} name="code" id="code" autoFocus>
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
                  )}
                  <Button
                    fullWidth
                    size="L"
                    variant="primary"
                    style={{ height: '3.2rem' }}
                    type="submit"
                  >
                    {formatMessage({
                      id: getTranslation('verify_page.submit'),
                      defaultMessage: 'Submit Code',
                    })}
                  </Button>
                </Flex>
              </form>
            </Box>
          </Wrapper>

          <Flex justifyContent="center">
            <Box paddingTop={4}>
              <Button variant="ghost" onClick={() => setUseRecoveryCode((prev) => !prev)}>
                {useRecoveryCode
                  ? formatMessage({
                      id: getTranslation('general.use_verification_code'),
                      defaultMessage: 'Use verification code',
                    })
                  : formatMessage({
                      id: getTranslation('general.use_recovery_code'),
                      defaultMessage: 'Use recovery code',
                    })}
              </Button>
            </Box>
          </Flex>
        </Main>
      </Box>
    </div>
  );
};
