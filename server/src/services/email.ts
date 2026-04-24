import type strapiEmail from '@strapi/email/dist/server/src';
type StrapiEmailService = ReturnType<typeof strapiEmail.services.email>;

export const send = async (to: string, otp: string) => {
  const emailService: StrapiEmailService = strapi.plugin('email').service('email');

  if (!emailService) return;

  // If an email address was somehow missing, just skip sending the email
  if (!to) return;

  const config = await strapi.service('plugin::strapi-identity.config').getConfig();

  if (!config.email_enabled) return;

  const sendConfig: Parameters<StrapiEmailService['send']>[0] = {
    to,
    subject: config.subject,
    text: replaceTemplateVariables<{ OTP: string }>(config.text, { OTP: otp }),
    html: replaceTemplateVariables<{ OTP: string; YEAR: string }>(config.message, {
      OTP: otp,
      YEAR: new Date().getFullYear().toString(),
    }),
  };

  // If the from email is set, use it. Otherwise, rely on the email provider's default.
  if (config.from_email) {
    sendConfig.from = config.from_name
      ? `${config.from_name} <${config.from_email}>`
      : config.from_email;
  }

  // If the response email is set, use it as the replyTo address.
  if (config.response_email && config.response_email !== config.from_email) {
    sendConfig.replyTo = config.response_email;
  }

  return emailService.send(sendConfig).catch((error) => {
    strapi.log.error('Error sending email');
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
