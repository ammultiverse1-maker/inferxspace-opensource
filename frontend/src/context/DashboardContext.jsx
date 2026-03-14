import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userApi, usageApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

const DashboardContext = createContext(null);

export const DashboardProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            setLoading(true);

            // Fetch dashboard summary
            const dashboardRes = await userApi.getDashboard();
            setDashboardData(dashboardRes.data);

            // Fetch usage chart (last 30 days)
            try {
                const chartRes = await usageApi.getChart('tokens', 'day');
                const payload = chartRes.data || chartRes;
                const points = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);

                // Format chart data for Recharts
                const formattedChartData = points.map(point => ({
                    day: new Date(point.label).getDate(),
                    fullDate: point.label,
                    tokens: point.value
                }));
                setChartData(formattedChartData);
            } catch (e) {
                console.error("Failed to fetch chart", e);
                setChartData([]);
            }

            // Fetch recent activity (logs)
            try {
                const logsRes = await usageApi.getLogs(1, 5); // First 5 logs
                const formattedLogs = logsRes.data.logs.map(log => ({
                    date: new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    model: log.model_id,
                    requests: 1,
                    tokens: `${((log.input_tokens + log.output_tokens) / 1000).toFixed(1)}K`
                }));
                setRecentActivity(formattedLogs);
            } catch (e) {
                console.error("Failed to fetch activity", e);
                setRecentActivity([]);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Initial load
    useEffect(() => {
        if (isAuthenticated) {
            fetchDashboardData();
        }
    }, [isAuthenticated, fetchDashboardData]);

    // Refresh function that can be called from anywhere
    const refreshDashboard = useCallback(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const value = {
        dashboardData,
        chartData,
        recentActivity,
        loading,
        refreshDashboard
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
};