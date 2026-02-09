// Components
import { Layouts, Page } from '@strapi/strapi/admin';
import { Button, Field, Flex, Grid, TextInput, Toggle } from '@strapi/design-system';
import { Check } from '@strapi/icons';

// Helpers
import { getTranslation } from '../utils/getTranslation';

// Hooks
import { useIntl } from 'react-intl';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { formatMessage } = useIntl();

  const [isLoading, setLoading] = useState(true);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Handle form submission logic here
  };

  // Get the initial settings from the server when the component mounts
  useEffect(() => {}, []);

  if (isLoading && false) {
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
        <form onSubmit={handleSubmit}>
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
              <Button disabled={true} type="submit" startIcon={<Check />} fullWidth>
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
                      <Field.Label action={'Geeky'}>
                        {formatMessage({
                          id: 'global.enabled',
                          defaultMessage: 'Enabled',
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
