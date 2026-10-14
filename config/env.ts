export const env = {
  // Local URL
  // apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.12:5001/api',
  // apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',

  // UAT URL
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://hunterx-backend-uat.up.railway.app/api',

  // Production URL
  // apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://hunterx-backend-production.up.railway.app/api',

  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
};

