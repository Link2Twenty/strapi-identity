import { useEffect, useState } from 'react';

// Compoenents
import { Box, Field, Flex, Grid, Toggle, Typography } from '@strapi/design-system';
import ConfirmModal from '../components/ConfirmModal';
import RemoveModal from '../components/RemoveModal';
import EmailOTPModal from '../components/EmailOTPModal/EmailOTPModal';

// Helpers
import { getToken } from '../utils/tokenHelpers';
import { getTranslation } from '../utils/getTranslation';

// Hooks
import { useIntl } from 'react-intl';

const ProfileToggle = () => {
  const { formatMessage } = useIntl();

  const [enabled, setEnabled] = useState<'full' | 'temp' | null>(null);
  const [mfaType, setMfaType] = useState<'totp' | 'email' | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');

  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [emailSetupOpen, setEmailSetupOpen] = useState(false);
  const [emailDisableOpen, setEmailDisableOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [passcodes, setPasscodes] = useState<string[] | null>(null);

  /**
   * Handle toggle of the TOTP MFA switch
   */
  const handleToggle = async ({ target }: { target: HTMLInputElement }) => {
    // Get jwtToken from cookies
    const token = getToken();

    const enable = target?.checked || false;

    if (!enable && enabled === 'full') {
      setDisableDialogOpen(true);
      return;
    }

    if (enable && enabled === 'full' && mfaType === 'email') {
      // Can't enable TOTP while email OTP is active
      return;
    }

    try {
      const response = await fetch('/strapi-identity/enable', {
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
      if (enable) setMfaType('totp');
    } catch (error) {
      console.error(error);
      setEnabled(null);
    }
  };

  /**
   * Handle toggle of the email OTP switch
   */
  const handleEmailToggle = ({ target }: { target: HTMLInputElement }) => {
    const enable = target?.checked || false;

    if (!enable && enabled === 'full' && mfaType === 'email') {
      setEmailDisableOpen(true);
      return;
    }

    if (enable && enabled === 'full') {
      // Another MFA method is already active — do nothing (UI prevents this visually)
      return;
    }

    if (enable) {
      setEmailSetupOpen(true);
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
      const response = await fetch('/strapi-identity/setup', {
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
      setMfaType('totp');
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
      const response = await fetch('/strapi-identity/disable', {
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
      setMfaType(null);
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
        const [statusRes, enabledRes, meRes] = await Promise.all([
          fetch('/strapi-identity/status', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
          fetch('/strapi-identity/config/enabled', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
          fetch('/admin/users/me', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
        ]);

        const statusBody = await statusRes.json();
        const enabledBody = await enabledRes.json();

        if (!statusRes.ok) {
          throw new Error(`${statusRes.status} - ${statusBody.error || 'Failed to get MFA status'}`);
        }

        if (!enabledRes.ok) {
          throw new Error(`${enabledRes.status} - ${enabledBody.error || 'Failed to get MFA config'}`);
        }

        setMfaEnabled(enabledBody.data);
        setEnabled(statusBody.data?.status || null);
        setMfaType(statusBody.data?.type || null);

        if (meRes.ok) {
          const meBody = await meRes.json();
          setUserEmail(meBody.data?.email || '');

          // Determine if email OTP is configured by checking the config
          const configRes = await fetch('/strapi-identity/config', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
            signal: ac.signal,
          });
          if (configRes.ok) {
            const configBody = await configRes.json();
            setEmailConfigured(!!configBody.data?.email_enabled);
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        console.error('Failed to fetch MFA status:', error);
      }
    })();

    return () => ac.abort();
  }, []);

  if (!mfaEnabled) return null;

  const totpChecked = enabled !== null && mfaType === 'totp';
  const emailChecked = enabled !== null && mfaType === 'email';
  const totpDisabled = enabled !== null && mfaType === 'email';
  const emailDisabled = enabled !== null && mfaType === 'totp';

  return (
    <>
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
              {formatMessage({
                id: getTranslation('profile.title'),
                defaultMessage: 'Two-Factor Authentication',
              })}
            </Typography>
            <Typography>
              {formatMessage({
                id: getTranslation('profile.subtitle'),
                defaultMessage: 'Add an additional layer of security to your account.',
              })}
            </Typography>
          </Flex>
          <Grid.Root tag="div" gap={5}>
            <Grid.Item col={6} s={12} alignItems="stretch">
              <Field.Root
                width="100%"
                name="two-factor-authentication"
                id="two-factor-authentication"
                hint={
                  totpDisabled
                    ? formatMessage({
                        id: getTranslation('profile.totp_disabled_hint'),
                        defaultMessage: 'Disable Email OTP first to enable the authenticator app.',
                      })
                    : undefined
                }
              >
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('profile.toggle_label'),
                    defaultMessage: 'Enable Two-Factor Authentication',
                  })}
                </Field.Label>
                <Toggle
                  offLabel={formatMessage({
                    id: 'app.components.ToggleCheckbox.off-label',
                    defaultMessage: 'False',
                  })}
                  onLabel={formatMessage({
                    id: 'app.components.ToggleCheckbox.on-label',
                    defaultMessage: 'True',
                  })}
                  checked={totpChecked}
                  onChange={handleToggle}
                  disabled={totpDisabled}
                />
                <Field.Hint />
              </Field.Root>
            </Grid.Item>

            {emailConfigured && (
              <Grid.Item col={6} s={12} alignItems="stretch">
                <Field.Root
                  width="100%"
                  name="email-otp"
                  id="email-otp"
                  hint={
                    emailDisabled
                      ? formatMessage({
                          id: getTranslation('profile.email_otp_disabled_hint'),
                          defaultMessage:
                            'Disable the authenticator app first to enable Email OTP.',
                        })
                      : undefined
                  }
                >
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('profile.email_otp_label'),
                      defaultMessage: 'Enable Email OTP',
                    })}
                  </Field.Label>
                  <Toggle
                    offLabel={formatMessage({
                      id: 'app.components.ToggleCheckbox.off-label',
                      defaultMessage: 'False',
                    })}
                    onLabel={formatMessage({
                      id: 'app.components.ToggleCheckbox.on-label',
                      defaultMessage: 'True',
                    })}
                    checked={emailChecked}
                    onChange={handleEmailToggle}
                    disabled={emailDisabled}
                  />
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>
            )}
          </Grid.Root>
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

      <EmailOTPModal
        mode="setup"
        open={emailSetupOpen}
        email={userEmail}
        onOpenChange={(open) => {
          if (!open) setEmailSetupOpen(false);
        }}
        onSuccess={() => {
          setEnabled('full');
          setMfaType('email');
          setEmailSetupOpen(false);
        }}
      />

      <EmailOTPModal
        mode="disable"
        open={emailDisableOpen}
        email={userEmail}
        onOpenChange={(open) => {
          if (!open) setEmailDisableOpen(false);
        }}
        onSuccess={() => {
          setEnabled(null);
          setMfaType(null);
          setEmailDisableOpen(false);
        }}
      />
    </>
  );
};

export default ProfileToggle;
