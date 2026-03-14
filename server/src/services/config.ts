const defaultConfig = {
  enabled: false,
  enforce: false,
  issuer: '',
  email_enabled: false,
  from_email: '',
  from_name: '',
  response_email: '',
  subject: '',
  text: '',
  message: '',
};

/**
 * Internal function to create a complete configuration object by merging provided options with default values
 * @param options partial configuration options to override defaults
 * @returns a complete configuration object with all required fields
 */
const _config = (options: Partial<typeof defaultConfig>): typeof defaultConfig => {
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

  return configDocument
    .update({ documentId: existingConfig.documentId, data: { ...existingConfig, ...data }, fields })
    .then((updated) => _config(updated));
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
    console.log('Error disabling MFA for all users:', err);
  }
};
