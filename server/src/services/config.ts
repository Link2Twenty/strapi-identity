import jwt from 'jsonwebtoken';

const defaultConfig = {
  email_enabled: false,
  enabled: false,
  enforce: false,
  from_email: '',
  from_name: '',
  issuer: '',
  message: '',
  response_email: '',
  subject: '',
  text: '',
};

/**
 * Internal function to create a complete configuration object by merging provided options with default values
 * @param options partial configuration options to override defaults
 * @returns a complete configuration object with all required fields
 */
const _config = (
  options: Partial<typeof defaultConfig> & Record<string, any>
): typeof defaultConfig => {
  return Object.assign({}, defaultConfig, options);
};

// Extract the keys of the default configuration to use when querying the database, ensuring we only retrieve relevant fields
const fields = Object.keys(defaultConfig) as (keyof typeof defaultConfig)[];

/**
 * Service for managing the Strapi Identity plugin configuration
 * @returns an object containing functions to get and update the plugin configuration
 */
export const isEnabled = async () => {
  const config = await getConfig();

  return config?.enabled || false;
};

/**
 * Retrieves the current configuration for the Strapi Identity plugin
 * @returns the current configuration
 */
export const getConfig = async () => {
  const configDocument = strapi.documents('plugin::strapi-identity.strapi-identity-config');

  return configDocument.findFirst({ fields }).then((config) => _config(config));
};

/**
 * Updates the Strapi Identity plugin configuration with the provided data
 * @param data partial configuration data to update
 * @returns  the updated configuration
 */
export const updateConfig = async (data: Partial<typeof defaultConfig>) => {
  const configDocument = strapi.documents('plugin::strapi-identity.strapi-identity-config');

  const existingConfig = await configDocument.findFirst();

  if (!existingConfig) {
    return configDocument.create({ data, fields }).then((created) => _config(created));
  }

  if (existingConfig.enabled && !data.enabled) await disableMFAForAllUsers();

  if (existingConfig.email_enabled && data.email_enabled === false)
    await disableEmailMFAForAllUsers();

  return configDocument
    .update({ documentId: existingConfig.documentId, data: { ...existingConfig, ...data }, fields })
    .then((updated) => _config(updated));
};

/**
 * Disables Email MFA for all users who have email as their MFA type
 * This is called when the admin turns off Email MFA in the settings
 */
const disableEmailMFAForAllUsers = async () => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
  const otpDocument = strapi.documents('plugin::strapi-identity.email-otp');

  try {
    const emailTokens = await tokenDocument.findMany({
      filters: { type: 'email', enabled: true },
    });

    await Promise.all([
      ...emailTokens.map((token) =>
        tokenDocument.update({
          documentId: token.documentId,
          data: { ...token, enabled: false },
        })
      ),
      // Clean up any pending email OTPs
      otpDocument
        .findMany({})
        .then((otps) =>
          Promise.all(otps.map((otp) => otpDocument.delete({ documentId: otp.documentId })))
        ),
    ]);
  } catch (err) {
    strapi.log.error('Error disabling email MFA for all users');
  }
};

/**
 * Disables MFA for all users by deleting all existing MFA tokens and temporary secrets
 * This is used when the admin turns off MFA in the settings, ensuring that all users are affected by this change
 */
const disableMFAForAllUsers = async () => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
  const tempDocument = strapi.documents('plugin::strapi-identity.mfa-temp');

  try {
    // Fetch all existing tokens and temporary secrets
    const [tokens, temps] = await Promise.all([
      tokenDocument.findMany({}),
      tempDocument.findMany({}),
    ]);

    // Delete all tokens and temporary secrets in parallel
    await Promise.all([
      ...tokens.map((token) => tokenDocument.delete({ documentId: token.documentId })),
      ...temps.map((temp) => tempDocument.delete({ documentId: temp.documentId })),
    ]);
  } catch (err) {
    strapi.log.error('Error disabling MFA for all users');
  }
};

/**
 * Checks if a user has MFA enabled by verifying the provided JWT token and checking for an associated MFA token in the database
 * @param jwtToken the JWT token to verify and extract the user ID from
 * @returns true if the user has MFA enabled, false otherwise
 */
export const checkUserByJWT = async (jwtToken: string) => {
  const config = await getConfig();
  const secret = strapi.config.get<string>('admin.auth.secret');

  if (!config.enabled) return false;

  let userId: string | undefined;
  try {
    const decoded = jwt.verify(jwtToken, secret) as { id?: string; userId?: string };
    userId = decoded.userId || decoded.id;
  } catch {
    return false;
  }

  if (!userId) return false;

  try {
    const mfaExists = await strapi.documents('plugin::strapi-identity.mfa-token').count({
      filters: { admin_user: { id: userId }, enabled: true },
    });

    return mfaExists > 0;
  } catch {
    return false;
  }
};
