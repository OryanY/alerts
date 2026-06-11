// contexts/ClientConfigContext.jsx — Global client configuration and date range state
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { toYMD_IL } from '../utils/dateUtils';
const ClientConfigContext = createContext();

export const useClientConfig = () => {
  const context = useContext(ClientConfigContext);
  if (!context) {
    throw new Error('useClientConfig must be used within ClientConfigProvider');
  }
  return context;
};

// Helper to get default date range (last 7 days) in Israeli timezone
const getDefaultDateRange = () => {
  const now = Date.now();
  return {
    start_date: toYMD_IL(now - 6 * 864e5), // 6 days ago in IL time
    end_date: toYMD_IL(now)                 // today in IL time
  };
};

export const ClientConfigProvider = ({ children }) => {
  // Load both config and date range from localStorage
  const [clientCfg, setClientCfg] = useState(() => {
    try {
      const saved = localStorage.getItem('client_cfg');
      return saved ? { ...DEFAULT_CLIENT_CFG, ...JSON.parse(saved) } : DEFAULT_CLIENT_CFG;
    } catch (e) {
      console.warn('Failed to load client config from localStorage:', e);
      return DEFAULT_CLIENT_CFG;
    }
  });

  const [dateRange, setDateRangeState] = useState(() => {
    try {
      const saved = localStorage.getItem('date_range');
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
      return localStorage.getItem('selected_panel') || null;
    } catch (e) {
      return null;
    }
  });

  // Persist config changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('client_cfg', JSON.stringify(clientCfg));
    } catch (e) {
      console.warn('Failed to save client config to localStorage:', e);
    }
  }, [clientCfg]);

  // Persist date range to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('date_range', JSON.stringify(dateRange));
    } catch (e) {
      console.warn('Failed to save date range to localStorage:', e);
    }
  }, [dateRange]);

  // Persist selected panel to localStorage
  useEffect(() => {
    try {
      if (selectedPanel) {
        localStorage.setItem('selected_panel', selectedPanel);
      } else {
        localStorage.removeItem('selected_panel');
      }
    } catch (e) {
      console.warn('Failed to save selected panel to localStorage:', e);
    }
  }, [selectedPanel]);

  const updateConfig = useCallback((newConfig) => {
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
      clusteringEnabled: typeof newConfig.clusteringEnabled === 'boolean'
        ? newConfig.clusteringEnabled
        : DEFAULT_CLIENT_CFG.clusteringEnabled,
      clusteringThreshold: toInt(newConfig.clusteringThreshold, DEFAULT_CLIENT_CFG.clusteringThreshold),
      bands: newConfig.bands?.map(b => ({
        ...b,
        min: toInt(b.min, 0),
        max: toInt(b.max, 1e9)
      })) || DEFAULT_CLIENT_CFG.bands
    };

    setClientCfg(sanitized);
  }, []);

  const resetConfig = useCallback(() => {
    setClientCfg(DEFAULT_CLIENT_CFG);
    try {
      localStorage.removeItem('client_cfg');
    } catch (e) {
      console.warn('Failed to remove client config from localStorage:', e);
    }
  }, []);

  const setDateRange = useCallback((newRange) => {
    setDateRangeState(prev => ({
      ...prev,
      ...newRange
    }));
  }, []);

  const setPresetRange = useCallback((days) => {
    const now = Date.now();
    setDateRangeState({
      start_date: toYMD_IL(now - (days - 1) * 864e5),
      end_date: toYMD_IL(now)
    });
  }, []);

  const setSelectedPanel = useCallback((panel) => {
    setSelectedPanelState(panel);
  }, []);

  // Generate API params from config
  const getApiParams = useCallback(() => {
    const bands = (clientCfg.bands && Array.isArray(clientCfg.bands)) ? clientCfg.bands : DEFAULT_CLIENT_CFG.bands;
    return {
      day_start: clientCfg.dayStart || DEFAULT_CLIENT_CFG.dayStart,
      day_end: clientCfg.dayEnd || DEFAULT_CLIENT_CFG.dayEnd,
      night_start: clientCfg.nightStart || DEFAULT_CLIENT_CFG.nightStart,
      night_end: clientCfg.nightEnd || DEFAULT_CLIENT_CFG.nightEnd,
      false_wakeup_threshold: clientCfg.falseWakeupThreshold || DEFAULT_CLIENT_CFG.falseWakeupThreshold,
      clustering_enabled: clientCfg.clusteringEnabled ?? DEFAULT_CLIENT_CFG.clusteringEnabled,
      clustering_threshold: clientCfg.clusteringThreshold || DEFAULT_CLIENT_CFG.clusteringThreshold,
      dur_short_max: bands.find(b => b.key === 'short')?.max ?? 59,
      dur_medium_max: bands.find(b => b.key === 'medium')?.max ?? 299
    };
  }, [clientCfg]);

  // Memoized so consumers only re-render when actual state changes
  const value = useMemo(() => ({
    config: clientCfg,
    updateConfig,
    resetConfig,
    getApiParams,
    dateRange,
    setDateRange,
    setPresetRange,
    selectedPanel,
    setSelectedPanel
  }), [clientCfg, updateConfig, resetConfig, getApiParams, dateRange, setDateRange, setPresetRange, selectedPanel, setSelectedPanel]);

  return (
    <ClientConfigContext.Provider value={value}>
      {children}
    </ClientConfigContext.Provider>
  );
};

export default ClientConfigContext;