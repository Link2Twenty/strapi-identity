import { useState } from 'react';

import { Button, Flex, Modal, TextInput, Typography } from '@strapi/design-system';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../InputOTP';

// Hooks
import { useIntl } from 'react-intl';

// Helpers
import { getTranslation } from '../../utils/getTranslation';

// Types
export interface RemoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

export default function RemoveModal({ open, onOpenChange, onSubmit }: RemoveModalProps) {
  const { formatMessage } = useIntl();

  const [showRecovery, setShowRecovery] = useState(false);

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <form onSubmit={onSubmit}>
          <Modal.Header>
            <Modal.Title>
              {formatMessage({
                id: getTranslation('profile.disable_title'),
                defaultMessage: 'Disable Two-Factor Authentication',
              })}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Flex direction="column" alignItems="center" gap={4} marginTop={4} marginBottom={4}>
              <Typography>
                {formatMessage({
                  id: getTranslation('profile.disable_instruction'),
                  defaultMessage:
                    'Enter the 6-digit code from your authenticator app to disable Two-Factor Authentication.',
                })}
              </Typography>
              {showRecovery ? (
                <TextInput name="otp" id="otp" />
              ) : (
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
              )}
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowRecovery((prev) => !prev)}
              >
                {showRecovery
                  ? formatMessage({
                      id: getTranslation('general.use_verification_code'),
                      defaultMessage: 'Use verification code',
                    })
                  : formatMessage({
                      id: getTranslation('general.use_recovery_code'),
                      defaultMessage: 'Use recovery code',
                    })}
              </Button>
            </Flex>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close>
              <Button variant="tertiary">
                {formatMessage({ id: 'app.components.Button.cancel', defaultMessage: 'Cancel' })}
              </Button>
            </Modal.Close>
            <Button type="submit">
              {formatMessage({ id: 'app.components.Button.confirm', defaultMessage: 'Confirm' })}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
