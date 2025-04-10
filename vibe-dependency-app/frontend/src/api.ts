import axios, { AxiosRequestConfig } from 'axios';

// Extend AxiosRequestConfig to include the retryCount property
interface RetryAxiosRequestConfig extends AxiosRequestConfig {
  retryCount?: number;
}

// Define the base URL for API requests
// In production, API calls are made to the same domain
// In development, we use the local backend server
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

console.log(`API requests will be sent to: ${API_URL}`);

// Maximum number of retry attempts
const MAX_RETRIES = 3;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 20000 // 20 seconds timeout (increased for large images)
});

// Simple client-side cache for requests
const requestCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_TIMEOUT = 60000; // 1 minute

// Request interceptor to track retry count
api.interceptors.request.use(config => {
  // Initialize retry count if not already set
  (config as RetryAxiosRequestConfig).retryCount = (config as RetryAxiosRequestConfig).retryCount || 0;
  return config;
});

// Add response interceptor to handle errors gracefully
api.interceptors.response.use(
  response => response,
  error => {
    const config = error.config as RetryAxiosRequestConfig;
    
    // If we haven't hit our max retries and it's a timeout or network error
    if (
      config && 
      config.retryCount !== undefined && 
      config.retryCount < MAX_RETRIES && 
      (error.code === 'ECONNABORTED' || 
       error.message.includes('timeout') || 
       error.message.includes('Network Error'))
    ) {
      // Increment the retry count
      config.retryCount = (config.retryCount || 0) + 1;
      
      console.log(`Retrying request (${config.retryCount}/${MAX_RETRIES})...`);
      
      // Create a new promise to handle the retry
      return new Promise(resolve => {
        // Delay between retries (exponential backoff: 1s, 2s, 4s)
        const backoffTime = 1000 * Math.pow(2, config.retryCount! - 1);
        setTimeout(() => resolve(api(config)), backoffTime);
      });
    }
    
    // If max retries reached or not a retriable error
    if (!error.response) {
      console.error('API Connection Error:', error.message);
      if (error.message.includes('Network Error')) {
        console.error(
          'Backend server may not be running. Please start the backend server at http://localhost:5000'
        );
      } else if (config && config.retryCount !== undefined && config.retryCount >= MAX_RETRIES) {
        console.error(`Request failed after ${MAX_RETRIES} retry attempts`);
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to make a GET request with caching
export const fetchWithCache = async (url: string, params?: any) => {
  const cacheKey = `${url}${JSON.stringify(params || {})}`;
  const now = Date.now();
  
  // Check if we have a non-expired cached request
  if (requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TIMEOUT) {
      console.log(`Using cached request for ${url}`);
      return cached.data;
    } else {
      // Expired cache entry
      requestCache.delete(cacheKey);
    }
  }
  
  // No valid cache entry, make a new request
  console.log(`Making new request for ${url}`);
  const response = await api.get(url, { params });
  
  // Store in cache
  requestCache.set(cacheKey, {
    data: response.data,
    timestamp: now
  });
  
  // Clean cache periodically
  if (requestCache.size > 100) {
    console.log('Cleaning request cache');
    const expireTime = now - CACHE_TIMEOUT;
    
    // Remove expired entries
    Array.from(requestCache.keys()).forEach(key => {
      const value = requestCache.get(key)!;
      if (value.timestamp < expireTime) {
        requestCache.delete(key);
      }
    });
  }
  
  return response.data;
};

export default api; 