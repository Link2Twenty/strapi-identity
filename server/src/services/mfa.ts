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
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
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
      ...record,
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
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');

  const record = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (!record) return false;

  // Email OTP type does not use TOTP validation
  if (record.type === 'email') return false;

  return validateToken(token, record.secret);
};

/**
 * Validates a TOTP token against the temporary secret for a given user
 * @param userId id of the user to validate against
 * @param token TOTP token to validate
 * @returns {Promise<boolean>} is the token valid
 */
export const validateTempToken = async (userId: string, token: string): Promise<boolean> => {
  const tempDocument = strapi.documents('plugin::strapi-identity.mfa-temp');

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
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
  const tempDocument = strapi.documents('plugin::strapi-identity.mfa-temp');
  const secret = new Secret({ size: 20 });

  const existingToken = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (existingToken) throw new Error('MFA is already enabled for this user');

  const existing = await tempDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (existing) {
    await tempDocument.update({
      documentId: existing.documentId,
      data: { ...existing, secret: secret.base32 },
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
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');
  const tempDocument = strapi.documents('plugin::strapi-identity.mfa-temp');

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
      data: { ...existing, type: 'totp', secret: tempField.secret, enabled: true, recovery_codes },
    });
  } else {
    await tokenDocument.create({
      data: {
        admin_user: { id: userId },
        type: 'totp',
        secret: tempField.secret,
        enabled: true,
        recovery_codes,
      },
    });
  }

  await tempDocument.delete({ documentId: tempField.documentId });

  return codes;
};

const EMAIL_OTP_EXPIRY_MINUTES = 10;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

/**
 * Generates a secure numeric OTP of the specified length, using rejection sampling to avoid bias
 */
const generateNumericOTP = (length: number): string => {
  const digits = '0123456789';
  const max = 256 - (256 % digits.length);
  const randomValues = new Uint8Array(length * 2);
  let result = '';

  while (result.length < length) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < randomValues.length && result.length < length; i++) {
      if (randomValues[i] >= max) continue;
      result += digits[randomValues[i] % digits.length];
    }
  }

  return result;
};

/**
 * Generates a 6-digit email OTP for a user, stores it hashed with expiry, and returns the plaintext code
 * @param userId id of the user to generate an OTP for
 * @param purpose the purpose of the OTP: 'login', 'setup', or 'disable'
 * @returns {Promise<string>} the plaintext OTP
 */
export const generateEmailOTP = async (
  userId: string,
  purpose: 'login' | 'setup' | 'disable' = 'login'
): Promise<string> => {
  const otpDocument = strapi.documents('plugin::strapi-identity.email-otp');

  const otp = generateNumericOTP(6);
  const code_hash = await bcrypt.hash(otp, 10);
  const expires_at = new Date(Date.now() + EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Delete any existing OTP for this user+purpose before creating a new one
  const existing = await otpDocument.findFirst({
    filters: { admin_user: { id: userId }, purpose },
  });
  if (existing) await otpDocument.delete({ documentId: existing.documentId });

  await otpDocument.create({
    data: { admin_user: { id: userId }, code_hash, expires_at, purpose, attempts: 0 },
  });

  return otp;
};

/**
 * Validates an email OTP for a given user and purpose.
 * Increments attempt count, rejects on expiry or too many attempts, removes the record on success.
 * @param userId id of the user to validate against
 * @param code plaintext OTP to validate
 * @param purpose the purpose of the OTP
 * @returns {Promise<boolean>} whether the code is valid
 */
export const validateEmailOTP = async (
  userId: string,
  code: string,
  purpose: 'login' | 'setup' | 'disable' = 'login'
): Promise<boolean> => {
  const otpDocument = strapi.documents('plugin::strapi-identity.email-otp');

  const record = await otpDocument.findFirst({ filters: { admin_user: { id: userId }, purpose } });

  if (!record) return false;

  if (new Date(record.expires_at as string) < new Date()) {
    await otpDocument.delete({ documentId: record.documentId });
    return false;
  }

  const attempts = (record.attempts as number) || 0;
  if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await otpDocument.delete({ documentId: record.documentId });
    return false;
  }

  await otpDocument.update({
    documentId: record.documentId,
    data: { ...record, attempts: attempts + 1 },
  });

  const isValid = await bcrypt.compare(code, record.code_hash as string);

  if (isValid) await otpDocument.delete({ documentId: record.documentId });

  return isValid;
};

/**
 * Enables email OTP MFA for a user, creating or updating their mfa-token record
 * @param userId id of the user to enable email MFA for
 */
export const enableEmailMFA = async (userId: string): Promise<void> => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');

  const existing = await tokenDocument.findFirst({ filters: { admin_user: { id: userId } } });

  if (existing) {
    await tokenDocument.update({
      documentId: existing.documentId,
      data: { ...existing, type: 'email', enabled: true, secret: '' },
    });
  } else {
    await tokenDocument.create({
      data: { admin_user: { id: userId }, type: 'email', enabled: true, secret: '' },
    });
  }
};

/**
 * Returns the MFA status and method type for a given user
 * @param userId id of the user to check
 * @returns the status and type of MFA, or null if not enabled
 */
export const getMFAInfo = async (
  userId: string
): Promise<{ status: 'full'; type: 'totp' | 'email' } | null> => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');

  const record = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (!record) return null;

  return { status: 'full', type: record.type as 'totp' | 'email' };
};

/**
 * Disables MFA for a user after validating the provided code.
 * For TOTP, validates against TOTP token or recovery code.
 * For email OTP, validates against a previously generated disable OTP.
 * @param userId id of the user to disable MFA for
 * @param code a valid TOTP token, recovery code, or email OTP
 */
export const disableSecret = async (userId: string, code: string): Promise<void> => {
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');

  const record = await tokenDocument.findFirst({
    filters: { admin_user: { id: userId }, enabled: true },
  });

  if (!record) throw new Error('MFA is not enabled for this user');

  let valid: boolean;
  if (record.type === 'email') {
    valid = await validateEmailOTP(userId, code, 'disable');
  } else {
    valid = await validateTokenOrRecoveryCode(userId, code);
  }

  if (!valid) throw new Error('Invalid token or recovery code');

  await tokenDocument.update({
    documentId: record.documentId,
    data: { ...record, enabled: false },
  });
};

/**
 * Disables the temporary secret for a user, effectively canceling the MFA setup process
 * @param userId id of the user to disable the temporary secret for
 */
export const disableTempSecret = async (userId: string): Promise<void> => {
  const tempDocument = strapi.documents('plugin::strapi-identity.mfa-temp');

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
  const tokenDocument = strapi.documents('plugin::strapi-identity.mfa-token');

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
