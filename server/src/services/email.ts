import type strapiEmail from '@strapi/email/dist/server/src';

export const send = async (to: string, otp: string) => {
  const emailService: ReturnType<typeof strapiEmail.services.email> = strapi
    .plugin('email')
    .service('email');

  if (!emailService) return;

  // If an email address was somehow missing, just skip sending the email
  if (!to) return;

  const config = await strapi.service('plugin::strapi-identity.config').getConfig();

  if (!config.email_enabled) return;

  return emailService
    .send({
      to,
      from: config.from_email || strapi.config.get('plugin::email.defaultFrom'),
      subject: config.subject,
      text: replaceTemplateVariables<{ OTP: string }>(config.text, { OTP: otp }),
      html: replaceTemplateVariables<{ OTP: string; YEAR: string }>(config.message, {
        OTP: otp,
        YEAR: new Date().getFullYear().toString(),
      }),
    })
    .catch((error) => {
      console.log('Error sending email:', error);
    });
};

/**
 * Replaces template variables in a string with their corresponding values.
 * @param template The template string containing variables in the format <%= VARIABLE %>.
 * @param variables An object containing the variable values to replace in the template.
 * @returns The template string with variables replaced by their corresponding values.
 */
export const replaceTemplateVariables = <T extends Record<string, string>>(
  template: string,
  variables: T
) => {
  return template.replace(/<%= (\w+) %>/g, (_, key: keyof T) => variables[key] || '');
};
