// Components
import { Layouts, Page } from '@strapi/strapi/admin';
import { Flex, Grid, Typography } from '@strapi/design-system';

// Helpers
import { getTranslation } from '../utils/getTranslation';

// Hooks
import { useIntl } from 'react-intl';

export default function SettingsPage() {
  const { formatMessage } = useIntl();

  return (
    <>
      <Page.Title>
        {formatMessage(
          { id: 'Settings.PageTitle', defaultMessage: 'Settings - {name}' },
          { name: getTranslation('plugin.name') }
        )}
      </Page.Title>
      <Page.Main>
        <Layouts.Header
          title={formatMessage({
            id: getTranslation('Settings.Name'),
            defaultMessage: 'Better Auth',
          })}
          subtitle={formatMessage({
            id: getTranslation('Settings.Description'),
            defaultMessage:
              'Settings for Better Auth plugin, allowing you to configure authentication options and security settings.',
          })}
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
                <Grid.Item col={6} xs={12} direction="column" alignItems="start">
                  <Typography variant="sigma" textColor="neutral600" tag="dt">
                    {formatMessage({
                      id: 'global.enabled',
                      defaultMessage: 'Enabled',
                    })}
                  </Typography>
                  <Flex gap={3} direction="column" alignItems="start" tag="dd">
                    <Typography>Hello world</Typography>
                  </Flex>
                </Grid.Item>
                <Grid.Item col={6} xs={12} direction="column" alignItems="start">
                  <Typography variant="sigma" textColor="neutral600" tag="dt">
                    {formatMessage({
                      id: getTranslation('Settings.EnforcedMFA'),
                      defaultMessage: 'Enforced MFA',
                    })}
                  </Typography>
                  <Flex gap={3} direction="column" alignItems="start" tag="dd">
                    <Typography>Hello world</Typography>
                  </Flex>
                </Grid.Item>
                <Grid.Item col={6} xs={12} direction="column" alignItems="start">
                  <Typography variant="sigma" textColor="neutral600" tag="dt">
                    {formatMessage({
                      id: 'global.name',
                      defaultMessage: 'Name',
                    })}
                  </Typography>
                  <Flex gap={3} direction="column" alignItems="start" tag="dd">
                    <Typography>Hello world</Typography>
                  </Flex>
                </Grid.Item>
              </Grid.Root>
            </Flex>
          </Flex>
        </Layouts.Content>
      </Page.Main>
    </>
  );
}
