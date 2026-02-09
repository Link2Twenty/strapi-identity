import { useEffect, useState } from 'react';

// Components
import { Layouts, Page } from '@strapi/strapi/admin';
import { Button, Field, Flex, Grid, TextInput, Toggle } from '@strapi/design-system';
import { Check } from '@strapi/icons';

// Helpers
import { isEqual } from 'lodash';
import { getTranslation } from '../utils/getTranslation';
import { getToken } from '../utils/tokenHelpers';

// Hooks
import { useIntl } from 'react-intl';

// Types
type config = { enabled: boolean; enforce: boolean; issuer: string };

export default function SettingsPage() {
  const { formatMessage } = useIntl();

  const [canSave, setCanSave] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const [isLoading, setLoading] = useState(true);
  const [initialConfig, setInitialConfig] = useState<config | null>(null);

  /**
   * Handle form submission to save the settings
   * @param event the form submission event
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);

    const formData = new FormData(event.currentTarget);

    const values = Array.from(formData.entries()).reduce<Partial<config>>(
      (acc, [key, value]) => {
        if (key === 'enabled' || key === 'enforce') acc[key] = value === 'on';
        else if (key === 'issuer') acc[key] = String(value);

        return acc;
      },
      Object.assign({}, initialConfig)
    );

    try {
      const token = getToken();

      const response = await fetch('/better-auth/config', {
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
      setSaving(false);
    } catch (error) {
      console.error('Error updating config:', error);
    }
  };

  /**
   * Handle form changes to enable the save button when there are unsaved changes
   * @param event the form change event
   */
  const handleChange = (event: React.FormEvent<HTMLFormElement>) => {
    //console log the current form values for debugging
    const formData = new FormData(event.currentTarget);

    const values = Array.from(formData.entries()).reduce<Partial<config>>(
      (acc, [key, value]) => {
        if (key === 'enabled' || key === 'enforce') acc[key] = value === 'on';
        else if (key === 'issuer') acc[key] = String(value);

        return acc;
      },
      Object.assign({}, initialConfig)
    );

    setCanSave(!isEqual(values, initialConfig || {}));
  };

  // Get the initial settings from the server when the component mounts
  useEffect(() => {
    const ac = new AbortController();
    const token = getToken();

    (async () => {
      try {
        const response = await fetch('/better-auth/config', {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        });

        const json = await response.json();

        if (!response.ok) throw new Error('Failed to fetch config');

        const { data, error } = json;
        if (error) throw new Error(error);

        setLoading(false);
        setInitialConfig(data);
      } catch (error) {}
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
          { name: getTranslation('plugin.name') }
        )}
      </Page.Title>
      <Page.Main>
        <form onSubmit={handleSubmit} onChange={handleChange}>
          <Layouts.Header
            title={formatMessage({
              id: getTranslation('settings.name'),
              defaultMessage: 'Better Auth',
            })}
            subtitle={formatMessage({
              id: getTranslation('settings.description'),
              defaultMessage:
                'Settings for Better Auth plugin, allowing you to configure authentication options and security settings.',
            })}
            primaryAction={
              <Button disabled={!canSave} loading={isSaving} type="submit" startIcon={<Check />}>
                {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
              </Button>
            }
          />
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
                        defaultChecked={initialConfig?.enabled}
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
                        defaultChecked={initialConfig?.enforce}
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
            </Flex>
          </Layouts.Content>
        </form>
      </Page.Main>
    </>
  );
}
