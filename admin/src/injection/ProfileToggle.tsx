import { useEffect, useState } from 'react';

// Compoenents
import { Box, Field, Flex } from '@strapi/design-system';
import { Toggle, Typography } from '@strapi/design-system';
import ConfirmModal from '../components/ConfirmModal';
import RemoveModal from '../components/RemoveModal';

// Helpers
import { getToken } from '../utils/tokenHelpers';
import { getTranslation } from '../utils/getTranslation';

// Hooks
import { useIntl } from 'react-intl';

const ProfileToggle = () => {
  const { formatMessage } = useIntl();

  const [enabled, setEnabled] = useState<'full' | 'temp' | null>(null);

  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [passcodes, setPasscodes] = useState<string[] | null>(null);

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
          <Flex direction="row" alignItems="stretch" gap={6}>
            <Field.Root name="two-factor-authentication" id="two-factor-authentication">
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
    </>
  );
};

export default ProfileToggle;
