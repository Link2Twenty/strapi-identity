import { useEffect, useState } from 'react';

// Components
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Layouts, Page } from '@strapi/strapi/admin';
import ConfirmModal from '../components/ConfirmModal';
import EmailOTPModal from '../components/EmailOTPModal/EmailOTPModal';

// Helpers
import { getToken } from '../utils/tokenHelpers';
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
 * Inject the enforced MFA page route into the Strapi admin router
 */
export const InjectEnforced = async (app: StrapiApp) => {
  const _router = app.router as unknown as InjectPublicRouter;

  // Wait for the router to be initialized
  while (!_router.router) await new Promise((resolve) => setTimeout(resolve, 10));

  _router.router.routes?.[0].children?.push({
    path: 'strapi-identity/enforced',
    element: <EnforcedPage />,
  });
};

const EnforcedPage = () => {
  const { formatMessage } = useIntl();

  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // TOTP setup state
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [passcodes, setPasscodes] = useState<string[] | null>(null);

  // Email OTP setup state
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // On mount: redirect to /admin if MFA is already fully set up
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      const token = getToken();

      try {
        const [statusRes, configRes, meRes] = await Promise.all([
          fetch('/strapi-identity/status', {
            headers: { authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
          fetch('/strapi-identity/config', {
            headers: { authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
          fetch('/admin/users/me', {
            headers: { authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
        ]);

        if (statusRes.ok) {
          const statusBody = await statusRes.json();
          if (statusBody.data?.status === 'full') {
            window.location.replace('/admin');
            return;
          }
        }

        if (configRes.ok) {
          const configBody = await configRes.json();
          setEmailConfigured(!!configBody.data?.email_enabled);
        }

        if (meRes.ok) {
          const meBody = await meRes.json();
          setUserEmail(meBody.data?.email || '');
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Failed to check MFA status:', error);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  const handleEnableTOTP = async () => {
    const token = getToken();

    try {
      const response = await fetch('/strapi-identity/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ enable: true }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Failed to initiate TOTP setup');
      }

      setUri(body.data?.uri || null);
      setSecret(body.data?.secret || null);
      setTotpModalOpen(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmTOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get('otp');
    const token = getToken();

    try {
      const response = await fetch('/strapi-identity/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Failed to set up MFA');
      }

      if (body.data?.recoveryCodes) {
        setPasscodes(body.data.recoveryCodes);
      } else {
        window.location.replace('/admin');
      }

      setUri(null);
      setSecret(null);
    } catch (error) {
      console.error(error);
    }
  };

  // Called when the TOTP modal closes — navigate to /admin if setup completed (passcodes were shown)
  const handleCloseTOTP = () => {
    if (passcodes) {
      window.location.replace('/admin');
      return;
    }

    setTotpModalOpen(false);
    setUri(null);
    setSecret(null);
    setPasscodes(null);
  };

  if (loading) return null;

  return (
    <>
      <Page.Title>
        {formatMessage({
          id: getTranslation('enforced.page_title'),
          defaultMessage: 'MFA Required',
        })}
      </Page.Title>
      <Page.Main>
        <Layouts.Header
          title={formatMessage({
            id: getTranslation('enforced.title'),
            defaultMessage: 'Multi-Factor Authentication Required',
          })}
          subtitle={formatMessage({
            id: getTranslation('enforced.subtitle'),
            defaultMessage:
              'Your administrator requires MFA to be configured before you can access the CMS.',
          })}
        />
        <Layouts.Content>
          <Box
            background="neutral0"
            hasRadius
            shadow="tableShadow"
            paddingTop={6}
            paddingBottom={6}
            paddingLeft={7}
            paddingRight={7}
          >
            <Flex direction="column" alignItems="stretch" gap={4}>
              <Flex direction="column" alignItems="stretch" gap={1}>
                <Typography variant="delta" tag="h2">
                  {formatMessage({
                    id: getTranslation('enforced.card_title'),
                    defaultMessage: 'Set Up Two-Factor Authentication',
                  })}
                </Typography>
                <Typography>
                  {formatMessage({
                    id: getTranslation('enforced.description'),
                    defaultMessage:
                      'To continue using the CMS, you must enable at least one Multi-Factor Authentication method. Choose an option below to get started.',
                  })}
                </Typography>
              </Flex>

              <Flex gap={3} wrap="wrap">
                <Button size="L" onClick={handleEnableTOTP}>
                  {formatMessage({
                    id: getTranslation('enforced.setup_totp'),
                    defaultMessage: 'Set up Authenticator App',
                  })}
                </Button>

                {emailConfigured && (
                  <Button size="L" variant="secondary" onClick={() => setEmailModalOpen(true)}>
                    {formatMessage({
                      id: getTranslation('enforced.setup_email'),
                      defaultMessage: 'Set up Email OTP',
                    })}
                  </Button>
                )}
              </Flex>
            </Flex>
          </Box>
        </Layouts.Content>
      </Page.Main>

      <ConfirmModal
        open={totpModalOpen}
        onOpenChange={handleCloseTOTP}
        qrCodeUri={uri}
        secret={secret}
        passcodes={passcodes}
        onSubmit={handleConfirmTOTP}
      />

      <EmailOTPModal
        mode="setup"
        open={emailModalOpen}
        email={userEmail}
        onOpenChange={(open) => {
          if (!open) setEmailModalOpen(false);
        }}
        onSuccess={() => {
          window.location.replace('/admin');
        }}
      />
    </>
  );
};

export { EnforcedPage };
