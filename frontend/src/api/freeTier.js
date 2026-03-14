/**
 * Free Tier API Endpoints
 */
import api from './client';

export const freeTierApi = {
  // Quota
  getQuota: () => api.get('/api/free-tier/quota'),
  
  // Free tier models
  getModels: () => api.get('/api/free-tier/models'),
  
  // Provider status
  getProvidersStatus: () => api.get('/api/free-tier/providers/status'),
  
  // Pool status (admin)
  getPoolStatus: (providerId) => api.get(`/api/free-tier/pool-status/${providerId}`),
};

