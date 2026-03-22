import { useEffect, useRef, useState } from 'react';

// Components
import WarningAlert from '../components/WarningAlert';
import { Layouts, Page, useNotification } from '@strapi/strapi/admin';
import {
  Button,
  Field,
  Flex,
  Grid,
  Textarea,
  TextInput,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { Check } from '@strapi/icons';

// Helpers
import { isEqual } from 'lodash';
import { getTranslation } from '../utils/getTranslation';
import { getToken } from '../utils/tokenHelpers';

// Hooks
import { useIntl } from 'react-intl';
// Types
type config = {
  enabled: boolean;
  enforce: boolean;
  issuer: string;
  email_enabled: boolean;
  from_email: string;
  from_name: string;
  response_email: string;
  subject: string;
  text: string;
  message: string;
  [key: string]: boolean | string; // Add index signature
};

// Constants
const defaultConfig = {
  enabled: false,
  enforce: false,
  issuer: 'Strapi',
  email_enabled: false,
  from_email: '',
  from_name: '',
  response_email: '',
  subject: 'Your One-Time Password',
  text: 'Your one-time password is: <%= OTP %>',
  message: `<div style="margin: 0; padding: 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f9f9f9">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" bgcolor="#ffffff" style="border: 1px solid #dddddd;">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <font face="Arial, sans-serif" size="5" color="#333333">
                                <strong>Verify Your Account</strong>
                            </font>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 40px 20px 40px;">
                            <font face="Arial, sans-serif" size="3" color="#555555" style="line-height: 24px;">
                                Please use the following one-time password to complete your registration. This code will expire in 10 minutes.
                            </font>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px;">
                            <table border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" bgcolor="#f4f4f4" style="padding: 20px 30px; font-family: Courier, monospace; font-size: 36px; color: #2d3436;">
                                        <strong><%= OTP %></strong>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px 40px 40px;">
                            <font face="Arial, sans-serif" size="2" color="#888888">
                                If you did not request this code, please ignore this email.
                            </font>
                        </td>
                    </tr>
                </table>
                <table border="0" cellpadding="0" cellspacing="0" width="600">
                    <tr>
                        <td align="center" style="padding: 20px;">
                            <font face="Arial, sans-serif" size="1" color="#aaaaaa">
                                &copy; <%= YEAR %> Your Company Name
                            </font>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</div>`,
} as const;

/**
 * Utility function to extract config values from form data
 * @param formData the form data to extract values from
 * @returns a config object with the extracted values
 */
const getConfigFromForm = (formData: FormData) => {
  return Array.from(formData.entries()).reduce<config>(
    (acc, [key, value]) => {
      if (key === 'enabled' || key === 'enforce' || key === 'email_enabled') {
        acc[key] = value === 'on';
      } else {
        acc[key] = String(value);
      }

      return acc;
    },
    Object.assign({}, defaultConfig)
  );
};

export default function SettingsPage() {
  const formRef = useRef<HTMLFormElement>(null);

  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();

  const [showWarning, setShowWarning] = useState(false);
  const [showEmailWarning, setShowEmailWarning] = useState(false);

  const [canSave, setCanSave] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const [isLoading, setLoading] = useState(true);
  const [initialConfig, setInitialConfig] = useState<config | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [enforce, setEnforce] = useState(false);

  /**
   * Handle form submission to save the settings
   * @param event the form submission event
   */
  const handleSubmit = async (
    event:
      | React.FormEvent<HTMLFormElement>
      | { preventDefault?: () => {}; currentTarget: HTMLFormElement },
    confirmed?: boolean
  ) => {
    event?.preventDefault?.();

    setSaving(true);

    const formData = new FormData(event.currentTarget);
    const values = getConfigFromForm(formData);

    if (initialConfig?.enabled && !values.enabled && !confirmed) {
      setShowWarning(true);
      setSaving(false);
      return;
    }

    if (initialConfig?.email_enabled && !values.email_enabled && !confirmed) {
      setShowEmailWarning(true);
      setSaving(false);
      return;
    }

    try {
      const token = getToken();

      const response = await fetch('/strapi-identity/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const json = await response.json();

      if (!response.ok) throw new Error('Failed to update config');

      const { data, error } = json;
      if (error) throw new Error(error);

      setInitialConfig(data);
      setCanSave(false);

      toggleNotification({
        type: 'success',
        message: formatMessage({ id: 'notification.success.saved', defaultMessage: 'Saved' }),
      });
    } catch (error) {
      console.error('Error updating config:', error);

      toggleNotification({
        type: 'danger',
        message: formatMessage({ id: 'notification.error', defaultMessage: 'An error occured' }),
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle form changes to enable the save button when there are unsaved changes
   * @param event the form change event
   */
  const handleChange = (event: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const values = getConfigFromForm(formData);

    setCanSave(!isEqual(values, initialConfig || {}));
  };

  // Get the initial settings from the server when the component mounts
  useEffect(() => {
    const ac = new AbortController();
    const token = getToken();

    (async () => {
      try {
        const response = await fetch('/strapi-identity/config', {
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          signal: ac.signal,
        });

        const json = await response.json();

        if (!response.ok) throw new Error('Failed to fetch config');

        const { data, error } = json;
        if (error) throw new Error(error);

        setInitialConfig(data);
        setEnabled(data.enabled);
        setEmailEnabled(data.email_enabled);
        setEnforce(data.enforce);
      } catch (error) {
        console.error('Error fetching config:', error);

        toggleNotification({
          type: 'danger',
          message: formatMessage({ id: 'notification.error', defaultMessage: 'An error occured' }),
        });
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <>
      <Page.Title>
        {formatMessage(
          { id: 'Settings.PageTitle', defaultMessage: 'Settings - {name}' },
          { name: 'Strapi Identity' }
        )}
      </Page.Title>
      <Page.Main>
        <form onSubmit={handleSubmit} onChange={handleChange} ref={formRef}>
          <Layouts.Header
            title={formatMessage({
              id: getTranslation('settings.name'),
              defaultMessage: 'Strapi Identity',
            })}
            subtitle={formatMessage({
              id: getTranslation('settings.description'),
              defaultMessage:
                'Settings for Strapi Identity plugin, allowing you to configure authentication options and security settings.',
            })}
            primaryAction={
              <Button disabled={!canSave} loading={isSaving} type="submit" startIcon={<Check />}>
                {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
              </Button>
            }
          />
          <Flex direction="column" gap={6}>
            <Layouts.Content>
              <Flex direction="column" alignItems="stretch" gap={6}>
                <Flex
                  direction="column"
                  alignItems="stretch"
                  gap={4}
                  hasRadius
                  background="neutral0"
                  shadow="tableShadow"
                  paddingTop={6}
                  paddingBottom={6}
                  paddingRight={7}
                  paddingLeft={7}
                >
                  <Flex direction="column" alignItems="stretch" gap={1}>
                    <Typography variant="delta" tag="h2">
                      {formatMessage({
                        id: getTranslation('profile.title'),
                        defaultMessage: 'Two-Factor Authentication',
                      })}
                    </Typography>
                  </Flex>
                  <Grid.Root gap={5} tag="dl">
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root
                        hint={formatMessage({
                          id: getTranslation('settings.enabled_hint'),
                          defaultMessage:
                            'Enable or disable Two-Factor Authentication for all users.',
                        })}
                      >
                        <Field.Label>
                          {formatMessage({ id: 'global.enabled', defaultMessage: 'Enabled' })}
                        </Field.Label>
                        <Toggle
                          name="enabled"
                          checked={enabled}
                          onChange={({ target }) => setEnabled(target.checked)}
                          offLabel={formatMessage({
                            id: 'app.components.ToggleCheckbox.off-label',
                            defaultMessage: 'False',
                          })}
                          onLabel={formatMessage({
                            id: 'app.components.ToggleCheckbox.on-label',
                            defaultMessage: 'True',
                          })}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root
                        hint={formatMessage({
                          id: getTranslation('settings.enforce_hint'),
                          defaultMessage:
                            'Enforce Multi-Factor Authentication for all users. If enabled, users will be required to set up MFA on their next login.',
                        })}
                      >
                        <Field.Label>
                          {formatMessage({
                            id: getTranslation('settings.enforce'),
                            defaultMessage: 'Enforce MFA',
                          })}
                        </Field.Label>
                        <Toggle
                          name="enforce"
                          checked={enforce}
                          onChange={({ target }) => setEnforce(target.checked)}
                          offLabel={formatMessage({
                            id: 'app.components.ToggleCheckbox.off-label',
                            defaultMessage: 'False',
                          })}
                          onLabel={formatMessage({
                            id: 'app.components.ToggleCheckbox.on-label',
                            defaultMessage: 'True',
                          })}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root
                        hint={formatMessage({
                          id: getTranslation('settings.issuer_hint'),
                          defaultMessage: 'Displayed in the MFA app',
                        })}
                      >
                        <Field.Label>
                          {formatMessage({
                            id: getTranslation('settings.issuer'),
                            defaultMessage: 'Issuer Name',
                          })}
                        </Field.Label>
                        <TextInput
                          name="issuer"
                          defaultValue={initialConfig?.issuer}
                          placeholder={formatMessage({
                            id: getTranslation('settings.issuer'),
                            defaultMessage: 'Issuer Name',
                          })}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                  </Grid.Root>
                </Flex>
                <Flex
                  direction="column"
                  alignItems="stretch"
                  gap={4}
                  hasRadius
                  background="neutral0"
                  shadow="tableShadow"
                  paddingTop={6}
                  paddingBottom={6}
                  paddingRight={7}
                  paddingLeft={7}
                >
                  <Flex direction="column" alignItems="stretch" gap={1}>
                    <Typography variant="delta" tag="h2">
                      {formatMessage({
                        id: getTranslation('settings.email_title'),
                        defaultMessage: 'Email Settings',
                      })}
                    </Typography>
                  </Flex>
                  <Grid.Root gap={5} tag="dl">
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root
                        hint={formatMessage({
                          id: getTranslation('settings.email_enabled_hint'),
                          defaultMessage: 'Enable or disable Email MFA.',
                        })}
                      >
                        <Field.Label>
                          {formatMessage({ id: 'global.enabled', defaultMessage: 'Enabled' })}
                        </Field.Label>
                        <Toggle
                          name="email_enabled"
                          checked={emailEnabled}
                          onChange={({ target }) => setEmailEnabled(target.checked)}
                          offLabel={formatMessage({
                            id: 'app.components.ToggleCheckbox.off-label',
                            defaultMessage: 'False',
                          })}
                          onLabel={formatMessage({
                            id: 'app.components.ToggleCheckbox.on-label',
                            defaultMessage: 'True',
                          })}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                  </Grid.Root>
                  <Grid.Root gap={5} tag="dl">
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: 'PopUpForm.Email.options.from.name.label',
                            defaultMessage: 'Shipper name',
                          })}
                        </Field.Label>
                        <TextInput name="from_name" defaultValue={initialConfig?.from_name || ''} />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: 'PopUpForm.Email.options.from.email.label',
                            defaultMessage: 'Shipper email',
                          })}
                        </Field.Label>
                        <TextInput
                          name="from_email"
                          defaultValue={initialConfig?.from_email || ''}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: 'PopUpForm.Email.options.response_email.label',
                            defaultMessage: 'Response email',
                          })}
                        </Field.Label>
                        <TextInput
                          name="response_email"
                          defaultValue={initialConfig?.response_email || ''}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: 'PopUpForm.Email.options.object.label',
                            defaultMessage: 'Subject',
                          })}
                        </Field.Label>
                        <TextInput name="subject" defaultValue={initialConfig?.subject || ''} />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={12} xs={12} direction="column" alignItems="stretch">
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: 'settings.accessibility_message',
                            defaultMessage: 'Accessibility Message',
                          })}
                        </Field.Label>
                        <TextInput name="text" defaultValue={initialConfig?.text || ''} />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                    <Grid.Item col={12} xs={12} direction="column" alignItems="stretch">
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: getTranslation('PopUpForm.Email.options.message.label'),
                            defaultMessage: 'Message',
                          })}
                        </Field.Label>
                        <Textarea
                          name="message"
                          defaultValue={initialConfig?.message || ''}
                          rows={15}
                        />
                        <Field.Hint />
                        <Field.Error />
                      </Field.Root>
                    </Grid.Item>
                  </Grid.Root>
                </Flex>
              </Flex>
            </Layouts.Content>
          </Flex>
        </form>
      </Page.Main>
      <WarningAlert
        open={showEmailWarning}
        onCancel={() => setShowEmailWarning(false)}
        onConfirm={() => {
          setShowEmailWarning(false);
          formRef.current && handleSubmit({ currentTarget: formRef.current }, true);
        }}
      >
        <Typography variant="omega" textAlign="center">
          {formatMessage({
            id: getTranslation('settings.email_warning'),
            defaultMessage:
              'Turning off Email MFA will disable Email OTP for all users who have it enabled.',
          })}
        </Typography>
        <Typography textAlign="center" fontWeight="semiBold">
          {formatMessage({
            id: getTranslation('app.confirm.body'),
            defaultMessage: 'Are you sure?',
          })}
        </Typography>
      </WarningAlert>
      <WarningAlert
        open={showWarning}
        onCancel={() => setShowWarning(false)}
        onConfirm={() => {
          setShowWarning(false);
          formRef.current && handleSubmit({ currentTarget: formRef.current }, true);
        }}
      >
        <Typography variant="omega" textAlign="center">
          {formatMessage({
            id: getTranslation('settings.warning'),
            defaultMessage:
              'Turning MFA off will affect all users. Please review the settings carefully before saving.',
          })}
        </Typography>
        <Typography textAlign="center" fontWeight="semiBold">
          {formatMessage({
            id: getTranslation('app.confirm.body'),
            defaultMessage: 'Are you sure?',
          })}
        </Typography>
      </WarningAlert>
    </>
  );
}
