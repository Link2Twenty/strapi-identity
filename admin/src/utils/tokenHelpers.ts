/**
 * Retrieves the value of a specified cookie.
 *
 * @param name - The name of the cookie to retrieve.
 * @returns The decoded cookie value if found, otherwise null.
 */
export const getCookieValue = (name: string): string | null => {
  const cookieArray = document.cookie.split(';');

  return cookieArray.reduce<string | null>((result, cookie) => {
    const [key, value] = cookie.split('=').map((item) => item.trim());

    return key === name ? decodeURIComponent(value) : result;
  }, null);
};

/**
 * Retrieves the JWT token from localStorage or cookies.
 * @returns The JWT token if found, otherwise null.
 */
export const getToken = (): string | null => {
  const fromLocalStorage = localStorage.getItem('jwtToken');
  if (fromLocalStorage) return JSON.parse(fromLocalStorage);

  const fromCookie = getCookieValue('jwtToken');
  return fromCookie ?? null;
};
