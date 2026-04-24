/**
 * Check if 2FA is enabled for a user by looking for an associated MFA token.
 * @param id the user's ID to check for an associated MFA token, indicating that 2FA is enabled for that user
 * @returns a boolean indicating whether 2FA is enabled for the user (true if an MFA token exists, false otherwise)
 */
export const isEnabled = (id: string) => {
  const mfaToken = strapi.query('plugin::strapi-identity.mfa-token');

  try {
    return mfaToken
      .count({ where: { admin_user: { id }, enabled: true } })
      .then((count) => count > 0);
  } catch (error) {
    strapi.log.error('Error checking if 2FA is enabled for user');
    return false;
  }
};

/**
 * Resets 2FA for a user by deleting any existing MFA token and temporary secret associated with that user.
 * @param id the user's ID for which to reset 2FA, which will delete any associated MFA token and temporary secret, effectively disabling 2FA for that user until they set it up again
 */
export const reset = async (id: string) => {
  const mfaToken = strapi.documents('plugin::strapi-identity.mfa-token');
  const mfaTemp = strapi.documents('plugin::strapi-identity.mfa-temp');

  try {
    const [existingToken, existingTemp] = await Promise.all([
      mfaToken.findFirst({ filters: { admin_user: { id } } }),
      mfaTemp.findFirst({ filters: { admin_user: { id } } }),
    ]);

    await Promise.all([
      existingToken ? mfaToken.delete({ documentId: existingToken.documentId }) : null,
      existingTemp ? mfaTemp.delete({ documentId: existingTemp.documentId }) : null,
    ]);
  } catch (error) {
    strapi.log.error('Error resetting 2FA for user');
    throw new Error('Failed to reset 2FA for user');
  }
};
