/**
 * Retrieves the current configuration for the Better Auth plugin
 * @returns the current configuration
 */
export const getConfig = async () => {
  const configDocument = strapi.documents('plugin::better-auth.better-auth-config');

  return configDocument.findFirst();
};

/**
 * Updates the Better Auth plugin configuration with the provided data
 * @param data partial configuration data to update
 * @returns  the updated configuration
 */
export const updateConfig = async (
  data: Partial<{ enabled: boolean; enforce: boolean; issuer: string }>
) => {
  const configDocument = strapi.documents('plugin::better-auth.better-auth-config');

  const existingConfig = await configDocument.findFirst();

  if (!existingConfig) {
    return configDocument.create({ data });
  }

  return configDocument.update({
    documentId: existingConfig.documentId,
    data: { ...existingConfig, ...data },
  });
};
