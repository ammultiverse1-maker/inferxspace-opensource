/**
 * API Endpoints
 */
import axios from 'axios';
import api from './client';

// Auth API
export const authApi = {
    getCsrf: () => api.get('/api/auth/csrf'),
    signup: (userData) => api.post('/api/auth/signup', userData),
    login: (credentials) => api.post('/api/auth/login', credentials),
    logout: () => api.post('/api/auth/logout'),
    me: () => api.get('/api/auth/me'),
    refresh: () => api.post('/api/auth/refresh'),
    changePassword: (data) => api.post('/api/auth/change-password', data),
};

// User API
export const userApi = {
    getProfile: () => api.get('/api/users/me'),
    updateProfile: (data) => api.put('/api/users/me', data),
    getDashboard: () => api.get('/api/users/me/dashboard'),
    getSettings: () => api.get('/api/users/me/settings'),
    updateSettings: (data) => api.put('/api/users/me/settings', data),
    deleteAccount: () => api.delete('/api/users/me'),
};

// API Keys API
export const apiKeyApi = {
    list: () => api.get('/api/api-keys'),
    create: (data) => api.post('/api/api-keys', data),
    update: (id, data) => api.put(`/api/api-keys/${id}`, data),
    regenerate: (id) => api.post(`/api/api-keys/${id}/regenerate`),
    delete: (id) => api.delete(`/api/api-keys/${id}`),
};

// Credits API
export const creditsApi = {
    getBalance: () => api.get('/api/credits/balance'),
    getPackages: () => api.get('/api/credits/packages'),
    createPurchase: (data) => api.post('/api/credits/purchase', data),
    testPurchase: (data) => api.post('/api/credits/test-purchase', data),
    verifyPayment: (data) => api.post('/api/credits/verify-payment', data),
    getPurchases: (page = 1, perPage = 20) => api.get(`/api/credits/purchases?page=${page}&per_page=${perPage}`),
    getTransactions: (page = 1, perPage = 50, type) => {
        let url = `/api/credits/transactions?page=${page}&per_page=${perPage}`;
        if (type) url += `&transaction_type=${type}`;
        return api.get(url);
    },
};

// Usage API
export const usageApi = {
    getStats: () => api.get('/api/usage/stats'),
    getAnalytics: (period = 'week') => api.get(`/api/usage/analytics?period=${period}`), // Backend supports date range, simplifed here
    getBreakdown: () => api.get('/api/usage/breakdown'),
    getLogs: (page = 1, perPage = 50) => api.get(`/api/usage/logs?page=${page}&per_page=${perPage}`),
    getChart: (metric = 'requests', interval = 'day') => api.get(`/api/usage/chart?metric=${metric}&interval=${interval}`),
};

// Models API
export const modelsApi = {
    list: () => api.get('/api/models'),
    get: (id) => api.get(`/api/models/${id}`),
};

// Pricing API
export const pricingApi = {
    getModels: () => api.get('/api/pricing/models'),
    getExchangeRate: () => api.get('/api/pricing/exchange-rate'),
    refreshPricing: () => api.post('/api/pricing/refresh'),
    estimateCost: (modelId, inputTokens, outputTokens) =>
        api.get(`/api/pricing/estimate?model_id=${modelId}&input_tokens=${inputTokens}&output_tokens=${outputTokens}`),
    getWallet: () => api.get('/api/pricing/wallet'),
};

// Completions API (for Playground)
export const completionsApi = {
    create: (data) => api.post('/v1/chat/completions', data),
};
