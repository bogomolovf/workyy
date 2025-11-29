// Configuration for Workyy Landing integration with Workyy Product
// These URLs point to the Next.js product application

export const PRODUCT_APP_URL =
  import.meta.env.VITE_PRODUCT_APP_URL ?? 'http://localhost:3000';

export const PRODUCT_APP_LOGIN_PATH = '/login';
export const PRODUCT_APP_SIGNUP_PATH = '/signup';
export const PRODUCT_APP_HOME_PATH = '/'; // Main page where users can create boards

// Full URLs for navigation
export const PRODUCT_LOGIN_URL = `${PRODUCT_APP_URL}${PRODUCT_APP_LOGIN_PATH}`;
export const PRODUCT_SIGNUP_URL = `${PRODUCT_APP_URL}${PRODUCT_APP_SIGNUP_PATH}`;
export const PRODUCT_HOME_URL = `${PRODUCT_APP_URL}${PRODUCT_APP_HOME_PATH}`;

