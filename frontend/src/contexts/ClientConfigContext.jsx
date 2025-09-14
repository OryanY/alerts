// contexts/ClientConfigContext.jsx — Global config management
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

export const ClientConfigProvider = ({ children }) => {
  const [clientCfg, setClientCfg] = useState(() => {
    try {
      const saved = localStorage.getItem('noc_client_cfg');
      return saved ? { ...DEFAULT_CLIENT_CFG, ...JSON.parse(saved) } : DEFAULT_CLIENT_CFG;
    } catch (e) {
      console.warn('Failed to load client config from localStorage:', e);
      return DEFAULT_CLIENT_CFG;
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
    getApiParams
  };

  return (
    <ClientConfigContext.Provider value={value}>
      {children}
    </ClientConfigContext.Provider>
  );
};

export default ClientConfigContext;