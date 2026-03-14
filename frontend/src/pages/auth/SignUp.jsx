import './Auth.css'
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import api from '../../api/client';
import logoWhite from '../../assets/logo-white-DDzi8NVg.svg';

const SignUp = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [canAcceptTerms, setCanAcceptTerms] = useState(false);
  const termsRef = useRef(null);

  const navigate = useNavigate();
  const { signup, oauthLogin } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!acceptTerms) {
      setError('Please accept the terms and conditions.');
      setIsLoading(false);
      return;
    }

    // Backend expects: email, password, full_name, company
    const signupData = {
      email: formData.email,
      password: formData.password,
      full_name: formData.name,
      company: formData.company
    };

    const result = await signup(signupData);

    if (result.success) {
      // New users always go to buy credits first
      navigate('/buy-credits');
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError('');
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoRes.json();

        const response = await api.post('/api/auth/oauth/google', {
          token: tokenResponse.access_token,
          user_info: userInfo,
        });

        if (response.data.user) {
          oauthLogin(response.data.user);
          navigate('/');
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Google signup failed. Please try again.');
        setIsLoading(false);
      }
    },
    onError: () => setError('Google signup failed. Please try again.'),
  });

  const handleGitHubSignup = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const scope = 'user:email';
    
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  };

  useEffect(() => {
    if (showTermsModal) {
      // reset accept state when opening
      setCanAcceptTerms(false);
      // scroll to top when opened
      setTimeout(() => {
        if (termsRef.current) termsRef.current.scrollTop = 0;
      }, 0);
    }
  }, [showTermsModal]);

  return (
    <div className="auth-container">
      <div className="auth-gradient">
        <div className="auth-branding">
          <div className="auth-logo">
            <img className="auth-logo-image" src={logoWhite} alt="InferXspace logo" />
            <span className="auth-logo-text">InferXspace</span>
          </div>
          <p className="brand-tagline">India's open-source LLM API platform</p>
        </div>
      </div>

      <div className="auth-form-wrapper">
        <div className="auth-form">
          <h2 className="auth-title">Create an account</h2>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Your email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="diya@ammultiverse.xyz"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkmark"></span>
                <span className="checkbox-text">
                  I agree to the{' '}
                  <button
                    type="button"
                    className="terms-link"
                    onClick={() => setShowTermsModal(true)}
                  >
                    Terms and Conditions
                  </button>
                </span>
              </label>
            </div>

            <button type="submit" className="btn-auth-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Creating account...</span>
                </>
              ) : (
                'Get Started'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="oauth-buttons">
            <button className="btn-google" onClick={() => googleLogin()} disabled={isLoading}>
              <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Google
            </button>

            <button className="btn-github" onClick={handleGitHubSignup} disabled={isLoading}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"/>
              </svg>
              GitHub
            </button>
          </div>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="modal-overlay auth-modal-overlay" onClick={() => setShowTermsModal(false)}>
            <div className="modal-content terms-modal auth-terms-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Terms and Conditions</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowTermsModal(false)}
                >
                  ×
                </button>
              </div>
              <div
                className="modal-body"
                ref={termsRef}
                onScroll={() => {
                  const el = termsRef.current;
                  if (!el) return;
                  if (el.scrollHeight - el.scrollTop <= el.clientHeight + 30) {
                    setCanAcceptTerms(true);
                  }
                }}
              >
                <div className="terms-content">
                <h4>1. Acceptance of Terms</h4>
                <p>By accessing and using InferXspace, you accept and agree to be bound by the terms and provision of this agreement.</p>

                <h4>2. Use License</h4>
                <p>Permission is granted to temporarily use InferXspace for personal, non-commercial transitory viewing only.</p>

                <h4>3. Disclaimer</h4>
                <p>The materials on InferXspace are provided on an 'as is' basis. InferXspace makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

                <h4>4. Limitations</h4>
                <p>In no event shall InferXspace or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use InferXspace.</p>

                <h4>5. Accuracy of Materials</h4>
                <p>The materials appearing on InferXspace could include technical, typographical, or photographic errors. InferXspace does not warrant that any of the materials on its website are accurate, complete, or current.</p>

                <h4>6. Links</h4>
                <p>InferXspace has not reviewed all of the sites linked to its Internet website and is not responsible for the contents of any such linked site.</p>

                <h4>7. Modifications</h4>
                <p>InferXspace may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.</p>

                <h4>8. Governing Law</h4>
                <p>These terms and conditions are governed by and construed in accordance with the laws of India and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.</p>

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    For the complete Terms and Conditions document, please visit:
                  </p>
                  <a 
                    href="https://inferx.space/terms" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: 'var(--text-primary)', 
                      textDecoration: 'underline',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}
                  >
                    https://inferx.space/terms
                  </a>
                </div>
                
                {!canAcceptTerms && (
                  <div className="scroll-indicator">
                    Scroll to continue
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 12l-4-4h8l-4 4z"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-primary-gradient"
                onClick={() => {
                  setAcceptTerms(true);
                  setShowTermsModal(false);
                }}
                disabled={!canAcceptTerms}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignUp;
