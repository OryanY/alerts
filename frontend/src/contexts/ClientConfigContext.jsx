// contexts/ClientConfigContext.jsx — WITH GLOBAL DATE RANGE
import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';

const ClientConfigContext = createContext();

export const useClientConfig = () => {
  const context = useContext(ClientConfigContext);
  if (!context) {
    throw new Error('useClientConfig must be used within ClientConfigProvider');
  }
  return context;
};

// Helper to get default date range (last 7 days)
const getDefaultDateRange = () => {
  const now = Date.now();
  const end = new Date(now);
  const start = new Date(now - 6 * 864e5); // 6 days ago
  
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0]
  };
};

export const ClientConfigProvider = ({ children }) => {
  // Load both config and date range from localStorage
  const [clientCfg, setClientCfg] = useState(() => {
    try {
      const saved = localStorage.getItem('noc_client_cfg');
      return saved ? { ...DEFAULT_CLIENT_CFG, ...JSON.parse(saved) } : DEFAULT_CLIENT_CFG;
    } catch (e) {
      console.warn('Failed to load client config from localStorage:', e);
      return DEFAULT_CLIENT_CFG;
    }
  });

  const [dateRange, setDateRangeState] = useState(() => {
    try {
      const saved = localStorage.getItem('noc_date_range');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate dates exist
        if (parsed.start_date && parsed.end_date) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load date range from localStorage:', e);
    }
    return getDefaultDateRange();
  });

  const [selectedPanel, setSelectedPanelState] = useState(() => {
    try {
      return localStorage.getItem('noc_selected_panel') || null;
    } catch (e) {
      return null;
    }
  });

  // Persist config changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('noc_client_cfg', JSON.stringify(clientCfg));
    } catch (e) {
      console.warn('Failed to save client config to localStorage:', e);
    }
  }, [clientCfg]);

  // Persist date range to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('noc_date_range', JSON.stringify(dateRange));
    } catch (e) {
      console.warn('Failed to save date range to localStorage:', e);
    }
  }, [dateRange]);

  // Persist selected panel to localStorage
  useEffect(() => {
    try {
      if (selectedPanel) {
        localStorage.setItem('noc_selected_panel', selectedPanel);
      } else {
        localStorage.removeItem('noc_selected_panel');
      }
    } catch (e) {
      console.warn('Failed to save selected panel to localStorage:', e);
    }
  }, [selectedPanel]);

  const updateConfig = (newConfig) => {
    const toInt = (v, fallback) => {
      const parsed = parseInt(v, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const sanitized = {
      ...newConfig,
      dayStart: toInt(newConfig.dayStart, DEFAULT_CLIENT_CFG.dayStart),
      dayEnd: toInt(newConfig.dayEnd, DEFAULT_CLIENT_CFG.dayEnd),
      nightStart: toInt(newConfig.nightStart, DEFAULT_CLIENT_CFG.nightStart),
      nightEnd: toInt(newConfig.nightEnd, DEFAULT_CLIENT_CFG.nightEnd),
      falseWakeupThreshold: toInt(newConfig.falseWakeupThreshold, DEFAULT_CLIENT_CFG.falseWakeupThreshold),
      bands: newConfig.bands?.map(b => ({
        ...b,
        min: toInt(b.min, 0),
        max: toInt(b.max, 1e9)
      })) || DEFAULT_CLIENT_CFG.bands
    };

    setClientCfg(sanitized);
  };

  const resetConfig = () => {
    setClientCfg(DEFAULT_CLIENT_CFG);
    try {
      localStorage.removeItem('noc_client_cfg');
    } catch (e) {
      console.warn('Failed to remove client config from localStorage:', e);
    }
  };

  const setDateRange = (newRange) => {
    setDateRangeState(prev => ({
      ...prev,
      ...newRange
    }));
  };

  const setPresetRange = (days) => {
    const now = Date.now();
    const end = new Date(now);
    const start = new Date(now - (days - 1) * 864e5);
    
    setDateRangeState({
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    });
  };

  const setSelectedPanel = (panel) => {
    setSelectedPanelState(panel);
  };

  // Generate API params from config
  const getApiParams = () => {
    const bands = (clientCfg.bands && Array.isArray(clientCfg.bands)) ? clientCfg.bands : DEFAULT_CLIENT_CFG.bands;
    return {
      day_start: clientCfg.dayStart || DEFAULT_CLIENT_CFG.dayStart,
      day_end: clientCfg.dayEnd || DEFAULT_CLIENT_CFG.dayEnd,
      night_start: clientCfg.nightStart || DEFAULT_CLIENT_CFG.nightStart,
      night_end: clientCfg.nightEnd || DEFAULT_CLIENT_CFG.nightEnd,
      false_wakeup_threshold: clientCfg.falseWakeupThreshold || DEFAULT_CLIENT_CFG.falseWakeupThreshold,
      dur_short_max: bands.find(b => b.key === 'short')?.max ?? 59,
      dur_medium_max: bands.find(b => b.key === 'medium')?.max ?? 299
    };
  };

  const value = {
    config: clientCfg,
    updateConfig,
    resetConfig,
    getApiParams,
    // NEW: Global date range
    dateRange,
    setDateRange,
    setPresetRange,
    // NEW: Global panel filter
    selectedPanel,
    setSelectedPanel
  };

  return (
    <ClientConfigContext.Provider value={value}>
      {children}
    </ClientConfigContext.Provider>
  );
};

export default ClientConfigContext;