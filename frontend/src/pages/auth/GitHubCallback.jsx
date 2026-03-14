import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const GitHubCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { oauthLogin } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleGitHubCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError('GitHub authentication was cancelled or failed.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!code) {
        setError('No authorization code received from GitHub.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        // Exchange code for access token via backend
        const response = await api.post('/api/auth/oauth/github/callback', { code });
        
        if (response.data.user) {
          oauthLogin(response.data.user);
          navigate('/');
        }
      } catch (err) {
        console.error('GitHub OAuth error:', err);
        setError(err.response?.data?.detail || 'GitHub authentication failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleGitHubCallback();
  }, [searchParams, navigate, setUser]);

  return (
    <div className="auth-container">
      <div className="auth-gradient">
        <div className="auth-branding">
          <h1 className="brand-title">
            <span className="brand-infer">Infer</span>
            <span className="brand-x">X</span>
            <span className="brand-space">space</span>
          </h1>
          <p className="brand-tagline">India's open-source LLM API platform</p>
        </div>
      </div>

      <div className="auth-form-wrapper">
        <div className="auth-form">
          {error ? (
            <>
              <div className="error-message" style={{ marginBottom: '20px' }}>
                {error}
              </div>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                Redirecting to login...
              </p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="auth-title">Authenticating with GitHub...</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                Please wait while we complete your sign-in.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitHubCallback;
