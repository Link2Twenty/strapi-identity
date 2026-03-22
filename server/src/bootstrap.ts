import type { Plugin } from '@strapi/types';

const defaultConfig = {
  enabled: false,
  enforce: false,
  issuer: 'Strapi',
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
};

const bootstrap: Plugin.LoadedPlugin['bootstrap'] = async ({ strapi }) => {
  const config = strapi.documents('plugin::strapi-identity.strapi-identity-config');
  const existingConfig = await config.count({});

  // If no configuration exists, create a default one
  if (!existingConfig) await config.create({ data: defaultConfig });

  // Register permissions
  strapi.admin.services.permission.actionProvider.registerMany([
    {
      uid: 'settings.read',
      section: 'plugins',
      displayName: 'Read',
      subCategory: 'settings',
      pluginName: 'strapi-identity',
    },
    {
      uid: 'settings.update',
      section: 'plugins',
      displayName: 'Update',
      subCategory: 'settings',
      pluginName: 'strapi-identity',
    },
  ]);
};

export default bootstrap;
