import bcrypt from 'bcryptjs';
import { Secret, TOTP } from 'otpauth';

/**
 * hashes a recovery code
 * @param code code to hash
 * @returns hashed recovery code
 */
const hashRecoveryCode = (code: string) => bcrypt.hash(code, 10);

/**
 * Validate a recovery code
 * @param code code to validate
 * @param hash hashed code to compare against
 * @returns {Promise<boolean>} is the recovery code valid
 */
const validateRecoveryCode = (code: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(code, hash);
};

/**
 * Validates a TOTP token against a secret
 * @param token TOTP token to validate
 * @param secret secret to validate against
 * @returns is the token valid
 */
const validateToken = (token: string, secret: string): boolean => {
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  const delta = totp.validate({ token, window: 1 });

  return delta !== null;
};

/**
 * Checks if a provided recovery code is valid for a given user
 * @param userId id of the user to check against
 * @param code recovery code to validate
 * @returns {Promise<boolean>} is the recovery code valid
 */
const checkRecoveryCode = async (userId: string, code: string): Promise<boolean> => {
  const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');
  const record = await tokenDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (!record || !Array.isArray(record.recovery_codes) || record.recovery_codes.length === 0)
    return false;

  const comparisonResults = await Promise.all(
    record.recovery_codes.map((hash: string) => validateRecoveryCode(code, hash))
  );

  const matchedIndex = comparisonResults.findIndex((result) => result);

  if (matchedIndex === -1) return false;

  // Remove the used recovery code from the database
  await tokenDocument.update({
    documentId: record.documentId,
    data: {
      recovery_codes: record.recovery_codes.filter(
        (_: string, index: number) => index !== matchedIndex
      ),
    },
  });

  return true;
};

/**
 * Validates a TOTP token for a given user
 * @param userId id of the user to validate against
 * @param token TOTP token to validate
 * @returns {Promise<boolean>} is the token valid
 */
const validateLiveToken = async (userId: string, token: string): Promise<boolean> => {
  const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');

  const record = await tokenDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (!record || !record.enabled) return false;

  return validateToken(token, record.secret);
};

/**
 * Validates a TOTP token against the temporary secret for a given user
 * @param userId id of the user to validate against
 * @param token TOTP token to validate
 * @returns {Promise<boolean>} is the token valid
 */
export const validateTempToken = async (userId: string, token: string): Promise<boolean> => {
  const tempDocument = strapi.documents('plugin::better-auth.mfa-temp');

  const record = await tempDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (!record) return false;

  return validateToken(token, record.secret);
};

/**
 * Validates a code against both the user's active TOTP secret and their recovery codes
 * @param userId id of the user to validate against
 * @param code code to validate (either TOTP token or recovery code)
 * @returns {Promise<boolean>} is the code valid
 */
export const validateTokenOrRecoveryCode = async (
  userId: string,
  code: string
): Promise<boolean> => {
  const isValidToken = await validateLiveToken(userId, code);
  if (isValidToken) return true;

  return checkRecoveryCode(userId, code);
};

/**
 * Sets up a temporary secret for a user during MFA setup
 * @param userId id of the user to set up MFA for
 * @return {Promise<Secret>} the generated temporary secret
 */
export const setupTemporarySecret = async (userId: string): Promise<Secret> => {
  const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');
  const tempDocument = strapi.documents('plugin::better-auth.mfa-temp');
  const secret = new Secret({ size: 20 });

  const existingToken = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (existingToken) throw new Error('MFA is already enabled for this user');

  const existing = await tempDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (existing) {
    await tempDocument.update({
      documentId: existing.documentId,
      data: { secret: secret.base32 },
    });
  } else {
    await tempDocument.create({
      data: { admin_user: { id: userId }, secret: secret.base32 },
    });
  }

  return secret;
};

/**
 * Finalizes MFA setup by moving the temporary secret to the main token document and generating recovery codes
 * @param userId id of the user to finalize MFA setup for
 * @returns {Promise<string[]>} the generated recovery codes
 */
export const setupFullSecret = async (userId: string): Promise<string[]> => {
  const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');
  const tempDocument = strapi.documents('plugin::better-auth.mfa-temp');

  const tempField = await tempDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (!tempField) throw new Error('No MFA setup in progress');

  const existing = await tokenDocument.findFirst({ filters: { admin_user: { id: userId } } });

  // generate 8 recovery codes
  const codes = Array.from({ length: 8 }).map(() => generateRecoveryCode(8));

  // hash the recovery codes before storing them
  const recovery_codes = await Promise.all(codes.map((code) => hashRecoveryCode(code)));

  if (existing) {
    await tokenDocument.update({
      documentId: existing.documentId,
      data: { secret: tempField.secret, enabled: true, recovery_codes },
    });
  } else {
    await tokenDocument.create({
      data: {
        admin_user: { id: userId },
        secret: tempField.secret,
        enabled: true,
        recovery_codes,
      },
    });
  }

  await tempDocument.delete({ documentId: tempField.documentId });

  return codes;
};

/**
 * Disables MFA for a user after validating the provided TOTP token or recovery code
 * @param userId id of the user to disable MFA for
 * @param code a valid TOTP token or recovery code for the user
 */
export const disableSecret = async (userId: string, code: string): Promise<void> => {
  const validToken = await validateTokenOrRecoveryCode(userId, code);

  if (!validToken) throw new Error('Invalid token or recovery code');

  const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');

  const record = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (!record) throw new Error('MFA is not enabled for this user');

  await tokenDocument.update({
    documentId: record.documentId,
    data: { enabled: false },
  });
};

/**
 * Disables the temporary secret for a user, effectively canceling the MFA setup process
 * @param userId id of the user to disable the temporary secret for
 */
export const disableTempSecret = async (userId: string): Promise<void> => {
  const tempDocument = strapi.documents('plugin::better-auth.mfa-temp');

  const record = await tempDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (!record) throw new Error('No MFA setup in progress');

  await tempDocument.delete({ documentId: record.documentId });
};

/**
 * Checks if MFA is currently enabled for a given user
 * @param userId id of the user to check
 * @returns {Promise<'full' | null>} is MFA enabled for the user
 */
export const isMFAEnabled = async (userId: string): Promise<'full' | null> => {
  const tokenDocument = strapi.documents('plugin::better-auth.mfa-token');

  const record = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (record) return 'full';

  return null;
};

/**
 * Generates a secure random recovery code of the specified length
 * @param length length of the recovery code to generate (default: 8)
 * @returns {string} the generated recovery code
 */
export const generateRecoveryCode = (length = 8): string => {
  // Define the character set: uppercase, lowercase, and numbers
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsetLength = charset.length;
  let result = '';

  // We will fill this buffer repeatedly until we've generated enough characters.
  const randomValues = new Uint8Array(length);

  // Compute the largest multiple of charsetLength less than or equal to 256.
  // Any random byte >= max would introduce modulo bias and is therefore rejected.
  const max = 256 - (256 % charsetLength);

  while (result.length < length) {
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < randomValues.length && result.length < length; i++) {
      const randomValue = randomValues[i];

      // Reject values that would cause modulo bias.
      if (randomValue >= max) {
        continue;
      }

      const index = randomValue % charsetLength;
      result += charset[index];
    }
  }

  return result;
};
