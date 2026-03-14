import { useState } from 'react';

import { Button, Flex, Modal, Typography } from '@strapi/design-system';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../InputOTP';

import { useIntl } from 'react-intl';
import { getToken } from '../../utils/tokenHelpers';
import { getTranslation } from '../../utils/getTranslation';

export interface EmailOTPModalProps {
  mode: 'setup' | 'disable';
  open: boolean;
  email: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EmailOTPModal({
  mode,
  open,
  email,
  onOpenChange,
  onSuccess,
}: EmailOTPModalProps) {
  const { formatMessage } = useIntl();

  const [step, setStep] = useState<'send' | 'confirm'>('send');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep('send');
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSend = async () => {
    const token = getToken();
    setLoading(true);
    setError(null);

    try {
      const endpoint =
        mode === 'setup'
          ? '/strapi-identity/enable-email'
          : '/strapi-identity/disable-email/request';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Failed to send verification email');
      }

      setStep('confirm');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get('otp') as string;

    setLoading(true);
    setError(null);

    try {
      const endpoint =
        mode === 'setup' ? '/strapi-identity/setup-email' : '/strapi-identity/disable';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Invalid or expired code');
      }

      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'setup'
      ? formatMessage({
          id: getTranslation('email_otp.setup_title'),
          defaultMessage: 'Enable Email OTP',
        })
      : formatMessage({
          id: getTranslation('email_otp.disable_title'),
          defaultMessage: 'Disable Email OTP',
        });

  return (
    <Modal.Root open={open} onOpenChange={handleOpenChange}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>

        {step === 'send' ? (
          <>
            <Modal.Body>
              <Flex direction="column" alignItems="center" gap={4} marginTop={4} marginBottom={4}>
                <Typography textAlign="center">
                  {mode === 'setup'
                    ? formatMessage(
                        {
                          id: getTranslation('email_otp.setup_description'),
                          defaultMessage:
                            "We'll send a 6-digit verification code to {email}. Enter it to enable Email OTP.",
                        },
                        { email: <strong>{email}</strong> }
                      )
                    : formatMessage(
                        {
                          id: getTranslation('email_otp.disable_description'),
                          defaultMessage:
                            "We'll send a 6-digit verification code to {email}. Enter it to disable Email OTP.",
                        },
                        { email: <strong>{email}</strong> }
                      )}
                </Typography>
                {error ? (
                  <Typography role="alert" textColor="danger600" textAlign="center">
                    {error}
                  </Typography>
                ) : null}
              </Flex>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close>
                <Button variant="tertiary">
                  {formatMessage({ id: 'app.components.Button.cancel', defaultMessage: 'Cancel' })}
                </Button>
              </Modal.Close>
              <Button onClick={handleSend} loading={loading}>
                {formatMessage({
                  id: getTranslation('email_otp.send_code'),
                  defaultMessage: 'Send verification email',
                })}
              </Button>
            </Modal.Footer>
          </>
        ) : (
          <form onSubmit={handleConfirm}>
            <Modal.Body>
              <Flex direction="column" alignItems="center" gap={4} marginTop={4} marginBottom={4}>
                <Typography textAlign="center">
                  {formatMessage(
                    {
                      id: getTranslation('email_otp.confirm_description'),
                      defaultMessage: 'Enter the 6-digit code sent to {email}.',
                    },
                    { email: <strong>{email}</strong> }
                  )}
                </Typography>
                <InputOTP maxLength={6} name="otp" id="otp" autoFocus>
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
                {error ? (
                  <Typography role="alert" textColor="danger600" textAlign="center">
                    {error}
                  </Typography>
                ) : null}
                <Button variant="ghost" type="button" onClick={() => handleSend()}>
                  {formatMessage({
                    id: getTranslation('email_otp.resend_code'),
                    defaultMessage: 'Resend code',
                  })}
                </Button>
              </Flex>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close>
                <Button variant="tertiary">
                  {formatMessage({
                    id: 'app.components.Button.cancel',
                    defaultMessage: 'Cancel',
                  })}
                </Button>
              </Modal.Close>
              <Button type="submit" loading={loading}>
                {formatMessage({
                  id: 'app.components.Button.confirm',
                  defaultMessage: 'Confirm',
                })}
              </Button>
            </Modal.Footer>
          </form>
        )}
      </Modal.Content>
    </Modal.Root>
  );
}
