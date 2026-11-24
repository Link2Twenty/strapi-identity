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
  options: Partial<typeof defaultConfig> & Record<string, unknown>
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
 * Error thrown when a config update contains a field with the wrong type
 */
export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

/**
 * Keeps only known config fields from untrusted input and checks each one has the same type as its default
 * @param input the raw request body
 * @returns the known fields that were present in the input
 * @throws {InvalidConfigError} if the input is not an object or a known field has the wrong type
 */
export const sanitizeConfig = (input: unknown): Partial<typeof defaultConfig> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidConfigError('Config must be an object');
  }

  const data: Partial<Record<keyof typeof defaultConfig, unknown>> = {};
  const present = new Set(Object.keys(input));

  for (const key of fields) {
    if (!present.has(key)) continue;

    const value = (input as Record<string, unknown>)[key];

    if (typeof value !== typeof defaultConfig[key]) {
      throw new InvalidConfigError(`"${key}" must be a ${typeof defaultConfig[key]}`);
    }

    data[key] = value;
  }

  return data as Partial<typeof defaultConfig>;
};

/**
 * Updates the Strapi Identity plugin configuration with the provided data.
 * Only fields that are present are changed; a missing field never turns a feature off.
 * @param input partial configuration data to update (untrusted, sanitized here)
 * @returns  the updated configuration
 */
export const updateConfig = async (input: unknown) => {
  const data = sanitizeConfig(input);
  const configDocument = strapi.documents('plugin::strapi-identity.strapi-identity-config');

  // Run the bulk MFA changes and the config update together, so a failure part way
  // through rolls everything back instead of leaving MFA half removed.
  return strapi.db.transaction(async () => {
    const existingConfig = await configDocument.findFirst();

    if (!existingConfig) {
      return configDocument.create({ data, fields }).then((created) => _config(created));
    }

    // Compare against `false` explicitly: an update that leaves `enabled` out must not wipe everyone's MFA
    if (existingConfig.enabled && data.enabled === false) await disableMFAForAllUsers();

    if (existingConfig.email_enabled && data.email_enabled === false)
      await disableEmailMFAForAllUsers();

    return configDocument
      .update({ documentId: existingConfig.documentId, data: data as Record<string, unknown>, fields })
      .then((updated) => _config(updated));
  });
};

/**
 * Disables Email MFA for all users who have email as their MFA type
 * This is called when the admin turns off Email MFA in the settings.
 * Runs sequentially because it is called inside a transaction, which uses a single connection.
 * Errors are not caught here so the surrounding transaction rolls back.
 */
const disableEmailMFAForAllUsers = async () => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
  const otpDocument = strapi.documents('plugin::strapi-identity.email-otp');

  const emailTokens = await tokenDocument.findMany({
    filters: { type: 'email', enabled: true },
  });

  for (const token of emailTokens) {
    await tokenDocument.update({
      documentId: token.documentId,
      data: { enabled: false } as Record<string, unknown>,
    });
  }

  // Clean up any pending email OTPs
  const otps = await otpDocument.findMany({});

  for (const otp of otps) {
    await otpDocument.delete({ documentId: otp.documentId });
  }
};

/**
 * Disables MFA for all users by deleting all existing MFA tokens and temporary secrets
 * This is used when the admin turns off MFA in the settings, ensuring that all users are affected by this change.
 * Runs sequentially because it is called inside a transaction, which uses a single connection.
 * Errors are not caught here so the surrounding transaction rolls back.
 */
const disableMFAForAllUsers = async () => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
  const tempDocument = strapi.documents('plugin::strapi-identity.mfa-temp');

  const tokens = await tokenDocument.findMany({});
  for (const token of tokens) {
    await tokenDocument.delete({ documentId: token.documentId });
  }

  const temps = await tempDocument.findMany({});
  for (const temp of temps) {
    await tempDocument.delete({ documentId: temp.documentId });
  }
};

/**
 * Returns the admin user ID carried by a JWT signed with the admin auth secret
 * @param token the JWT token to verify
 * @returns the user ID, or undefined if the token is not an admin JWT
 */
export const getAdminUserIdFromJWT = (token: string) => {
  const secret = strapi.config.get<string>('admin.auth.secret');

  try {
    const decoded = jwt.verify(token, secret, { ignoreExpiration: true }) as {
      id?: string;
      userId?: string;
    };
    return decoded.userId || decoded.id;
  } catch {
    return undefined;
  }
};

/**
 * Checks if a user has MFA enabled by verifying the provided JWT token and checking for an associated MFA token in the database
 * @param token the JWT token to verify and extract the user ID from
 * @returns true if the user has MFA enabled, false otherwise
 */
export const checkUserByJWT = async (token: string) => {
  const config = await getConfig();

  if (!config.enabled) return false;

  const userId = getAdminUserIdFromJWT(token);

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
