import { Button, Flex, Grid, Modal, Typography } from '@strapi/design-system';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../InputOTP';
import QRCode from 'react-qr-code';

// Types
export interface ConfirmModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  qrCodeUri?: string | null;
  secret?: string | null;
  passcodes?: string[] | null;
}

export default function ConfirmModal({
  open,
  onOpenChange,
  onSubmit,
  qrCodeUri,
  secret,
  passcodes,
}: ConfirmModalProps) {
  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <form onSubmit={onSubmit}>
          <Modal.Header>
            <Modal.Title>Set up Two-Factor Authentication</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {passcodes ? (
              <Flex direction="column" alignItems="center" gap={4} marginTop={4} marginBottom={4}>
                <Typography align="center">
                  Please save the following recovery codes in a safe place. Each code can only be
                  used once to access your account if you lose access to your authenticator app.
                </Typography>
                <Grid.Root gap={4} marginTop={4} marginBottom={4}>
                  {passcodes.map((code) => (
                    <Grid.Item key={code} col={6}>
                      <Typography variant="pi">{code}</Typography>
                    </Grid.Item>
                  ))}
                </Grid.Root>
                <Typography variant="pi" align="center">
                  If you lose both your authenticator app and your recovery codes, you will need to
                  contact an administrator to regain access to your account.
                </Typography>
              </Flex>
            ) : (
              <>
                <Flex direction="column" alignItems="center" gap={4} marginTop={4} marginBottom={4}>
                  <Typography>
                    You will need an authenticator app to scan the QR code below.
                  </Typography>
                  <QRCode value={qrCodeUri || ''} />
                  {secret && <Typography variant="pi">{secret || ''}</Typography>}
                </Flex>
                <hr
                  style={{
                    height: '1px',
                    border: '0',
                    backgroundColor: '#e5e5e5',
                  }}
                />
                <Flex direction="column" alignItems="center" gap={4} marginTop={4} marginBottom={4}>
                  <Typography>
                    Enter the 6-digit code from your authenticator app to verify the setup.
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
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            {passcodes && <span />}
            <Modal.Close>
              <Button variant={passcodes ? '' : 'tertiary'}>
                {passcodes ? 'Close' : 'Cancel'}
              </Button>
            </Modal.Close>
            {!passcodes && <Button type="submit">Confirm</Button>}
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
