type Config = { enabled: boolean; enforce: boolean; issuer: string };

export const getConfig = async () => {
  const configDocument = strapi.documents('plugin::better-auth.better-auth-config');

  return configDocument.findFirst();
};

export const updateConfig = async (data: Partial<Config>) => {
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
