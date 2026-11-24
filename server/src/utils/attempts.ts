/**
 * Atomic attempt counters for code checks.
 *
 * Each check first "claims" an attempt with a single UPDATE that only succeeds while the counter is
 * below the limit. The database applies it as one step, so parallel requests can't all read the
 * same count and slip past the limit.
 */

type UID = 'plugin::strapi-identity.mfa-token' | 'plugin::strapi-identity.email-otp';

/** Maximum failed checks per user before the account's MFA checks are locked */
export const MFA_MAX_FAILURES = 5;

/** How long a lock lasts */
export const MFA_LOCK_MS = 15 * 60 * 1000;

/**
 * Looks up the real table and column names, since Strapi may shorten or rename identifiers
 * @param uid the content type
 * @param attributes the attribute names to resolve
 */
const names = <K extends string>(uid: UID, attributes: K[]) => {
  const meta = strapi.db.metadata.get(uid);
  const columns = {} as Record<K, string>;

  for (const attribute of attributes) {
    const definition = meta.attributes[attribute] as { columnName?: string } | undefined;
    columns[attribute] = definition?.columnName || attribute;
  }

  return { table: meta.tableName, columns };
};

/**
 * Claims one attempt on a counter column: `SET col = col + 1 WHERE id = ? AND col < max`
 * @param uid the content type holding the counter
 * @param id the row id
 * @param attribute the integer counter attribute
 * @param max the limit
 * @returns true if an attempt was claimed, false if the limit was already reached
 */
export const claimAttempt = async (
  uid: UID,
  id: number | string,
  attribute: string,
  max: number
) => {
  const knex = strapi.db.connection;
  const { table, columns } = names(uid, [attribute]);
  const column = columns[attribute];

  const updated = await knex(table)
    .where('id', id)
    .andWhere(knex.raw('COALESCE(??, 0) < ?', [column, max]))
    .update({ [column]: knex.raw('COALESCE(??, 0) + 1', [column]) });

  return Number(updated) > 0;
};

/**
 * Records a TOTP time-step as used: `SET counter = step WHERE id = ? AND counter < step`.
 * Each code can then be used once, and never a code older than the newest one accepted.
 * For TOTP tokens the `counter` attribute holds the last accepted time-step.
 * @param tokenId id of the user's mfa-token row
 * @param step the time-step the submitted code matched
 * @returns true if the step was newer and is now recorded, false if it was already used
 */
export const claimTimeStep = async (tokenId: number | string, step: number) => {
  const knex = strapi.db.connection;
  const { table, columns } = names('plugin::strapi-identity.mfa-token', ['counter']);
  const column = columns.counter;

  const updated = await knex(table)
    .where('id', tokenId)
    .andWhere(knex.raw('COALESCE(??, 0) < ?', [column, step]))
    .update({ [column]: step });

  return Number(updated) > 0;
};

export type AttemptResult = 'valid' | 'invalid' | 'locked';

/**
 * Runs a code check for a user's MFA token under the per-user failure limit.
 * After MFA_MAX_FAILURES failed checks, every check is refused for MFA_LOCK_MS, whether or not the
 * code is right. A correct code resets the counter. The limit is per account, so spreading guesses
 * over many IPs or asking for new email codes doesn't help.
 * @param tokenId id of the user's mfa-token row
 * @param check the actual code check
 * @returns 'valid', 'invalid', or 'locked' (the check was not run)
 */
export const withUserAttempt = async (
  tokenId: number | string,
  check: () => Promise<boolean>
): Promise<AttemptResult> => {
  const uid = 'plugin::strapi-identity.mfa-token';
  const knex = strapi.db.connection;
  const { table, columns } = names(uid, ['failed_attempts', 'locked_until']);
  const failures = columns.failed_attempts;
  const lockedUntil = columns.locked_until;
  const now = Date.now();

  // A lock that has run out starts a fresh window. Conditional, so parallel requests only reset it once.
  await knex(table)
    .where('id', tokenId)
    .andWhere(failures, '>=', MFA_MAX_FAILURES)
    .andWhere(lockedUntil, '<=', now)
    .update({ [failures]: 0, [lockedUntil]: null });

  // Claim an attempt. The claim that reaches the limit also sets the lock in the same statement,
  // so there is no moment where the limit is reached but no lock is set yet.
  const claimed = await knex(table)
    .where('id', tokenId)
    .andWhere(knex.raw('COALESCE(??, 0) < ?', [failures, MFA_MAX_FAILURES]))
    .update({
      [failures]: knex.raw('COALESCE(??, 0) + 1', [failures]),
      [lockedUntil]: knex.raw('CASE WHEN COALESCE(??, 0) + 1 >= ? THEN ? ELSE ?? END', [
        failures,
        MFA_MAX_FAILURES,
        now + MFA_LOCK_MS,
        lockedUntil,
      ]),
    });

  if (Number(claimed) === 0) return 'locked';

  const valid = await check();

  if (valid) {
    await knex(table).where('id', tokenId).update({ [failures]: 0, [lockedUntil]: null });
    return 'valid';
  }

  return 'invalid';
};

/**
 * Checks that a submitted code is a non-empty string of sensible length, before it reaches
 * the TOTP or bcrypt libraries (which throw on other types)
 * @param code the submitted value
 */
export const isCodeShaped = (code: unknown): code is string =>
  typeof code === 'string' && code.length > 0 && code.length <= 64;
