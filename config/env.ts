export const env = {
  // Local URL
  // apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.12:5001/api',
  // apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',

  // UAT URL
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api-uat.hunterx.co.in/api',

  // Production URL
  // apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.hunterx.co.in/api',

  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
};

