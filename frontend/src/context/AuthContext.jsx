import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, userApi, creditsApi } from '../api/endpoints';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check auth status on mount - only if we have cookies
    useEffect(() => {
        // Check if we have auth cookies before attempting to verify
        const hasAuthCookies = document.cookie.includes('access_token') || document.cookie.includes('refresh_token');
        if (hasAuthCookies) {
            checkAuth();
        } else {
            // Check if we have user data in localStorage
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    setUser(userData);
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error('Error parsing stored user data:', error);
                    localStorage.removeItem('user');
                }
            }
            setLoading(false);
        }
    }, []);

    const checkAuth = async () => {
        try {
            const response = await userApi.getProfile();
            setUser(response.data);
            setIsAuthenticated(true);
            localStorage.setItem('user', JSON.stringify(response.data));
        } catch (error) {
            // Don't treat 401 as an error - just means not authenticated
            if (error.response?.status !== 401) {
                console.error('Auth check failed:', error);
            } else {
                // Clear any stale cookies on 401
                document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            }
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            // Login (sets cookie)
            const response = await authApi.login({ email, password });

            // Fetch user profile
            setUser(response.data.user);
            setIsAuthenticated(true);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Check if user has credits
            try {
                // Add delay to ensure cookies are set
                await new Promise(resolve => setTimeout(resolve, 500));
                const creditsResponse = await creditsApi.getBalance();
                if (creditsResponse.data.total_purchased > 0) {
                    // User has credits, redirect to dashboard
                    return {
                        success: true,
                        redirectToBuyCredits: false
                    };
                }
            } catch (creditsError) {
                console.warn('Could not check credits after login:', creditsError);
                // If we can't check credits, assume they need to buy
            }

            // User needs to buy credits first
            return {
                success: true,
                redirectToBuyCredits: true
            };
        } catch (error) {
            console.error('Login failed:', error);
            
            // Provide specific error messages
            let errorMessage = 'Login failed';
            
            if (error.response?.status === 401) {
                errorMessage = 'Invalid email or password';
            } else if (error.response?.status === 403) {
                errorMessage = 'Account is disabled. Please contact support.';
            } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const signup = async (data) => {
        try {
            const response = await authApi.signup(data);
            // Use the user data from the response instead of making another request
            setUser(response.data.user);
            setIsAuthenticated(true);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // New users always need to buy credits first
            return {
                success: true,
                redirectToBuyCredits: true
            };
        } catch (error) {
            console.error('Signup failed:', error);
            
            // Provide specific error messages
            let errorMessage = 'Signup failed';
            
            if (error.response?.status === 400) {
                errorMessage = error.response.data?.detail || 'Invalid signup data';
            } else if (error.response?.status === 409) {
                errorMessage = 'Email already registered';
            } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    };

    // OAuth login helper — sets user + auth state from OAuth response
    const oauthLogin = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthenticated,
            login,
            signup,
            logout,
            checkAuth,
            setUser,
            oauthLogin
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
