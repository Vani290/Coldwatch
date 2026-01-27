import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { SensorData, SensorThresholds, SensorStatus, LogEntry, HistoryEntry } from '@/types/sensor';
import { fetchLatestReading, fetchHistoricalReadings, SensorReading } from '@/services/thingspeak';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SensorContextType {
  currentData: SensorData;
  thresholds: SensorThresholds;
  status: SensorStatus;
  logs: LogEntry[];
  history: HistoryEntry[];
  updateThresholds: (thresholds: SensorThresholds) => void;
  isConnected: boolean;
  lastUpdate: Date | null;
}

const defaultThresholds: SensorThresholds = {
  temperature: { warning: 8, critical: 12 },
  humidity: { warning: 70, critical: 85 },
  gas: { warning: 300, critical: 500 },
};

const SensorContext = createContext<SensorContextType | undefined>(undefined);

export const useSensorData = () => {
  const context = useContext(SensorContext);
  if (!context) {
    throw new Error('useSensorData must be used within a SensorProvider');
  }
  return context;
};

export const SensorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentData, setCurrentData] = useState<SensorData>({
    temperature: 0,
    humidity: 0,
    gas: 0,
    timestamp: new Date(),
  });

  const [thresholds, setThresholds] = useState<SensorThresholds>(() => {
    const saved = localStorage.getItem('sensorThresholds');
    return saved ? JSON.parse(saved) : defaultThresholds;
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const lastEntryIdRef = useRef<number>(0);
  const emailSentRef = useRef<Set<string>>(new Set());

  const getStatus = useCallback((data: SensorData, thresholds: SensorThresholds): SensorStatus => {
    const getLevel = (value: number, threshold: { warning: number; critical: number }): 'normal' | 'warning' | 'critical' => {
      if (value >= threshold.critical) return 'critical';
      if (value >= threshold.warning) return 'warning';
      return 'normal';
    };

    const tempStatus = getLevel(data.temperature, thresholds.temperature);
    const humidStatus = getLevel(data.humidity, thresholds.humidity);
    const gasStatus = getLevel(data.gas, thresholds.gas);

    const statuses = [tempStatus, humidStatus, gasStatus];
    let overall: 'normal' | 'warning' | 'critical' = 'normal';
    if (statuses.includes('critical')) overall = 'critical';
    else if (statuses.includes('warning')) overall = 'warning';

    return {
      temperature: tempStatus,
      humidity: humidStatus,
      gas: gasStatus,
      overall,
    };
  }, []);

  const [status, setStatus] = useState<SensorStatus>(() => getStatus(currentData, thresholds));

  const addLog = useCallback((sensor: 'temperature' | 'humidity' | 'gas', value: number, threshold: number, logStatus: 'warning' | 'critical') => {
    const messages = {
      temperature: `Temperature ${logStatus === 'critical' ? 'critically high' : 'above normal'}: ${value}°C`,
      humidity: `Humidity ${logStatus === 'critical' ? 'critically high' : 'above normal'}: ${value}%`,
      gas: `Gas level ${logStatus === 'critical' ? 'critical' : 'elevated'}: ${value} PPM`,
    };

    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sensor,
      value,
      threshold,
      status: logStatus,
      message: messages[sensor],
    };

    setLogs(prev => [newLog, ...prev].slice(0, 500));
  }, []);

  const sendCriticalAlert = useCallback(async (data: SensorData, currentStatus: SensorStatus) => {
    const criticalSensors: string[] = [];
    
    if (currentStatus.temperature === 'critical') criticalSensors.push('Temperature');
    if (currentStatus.humidity === 'critical') criticalSensors.push('Humidity');
    if (currentStatus.gas === 'critical') criticalSensors.push('Gas');

    if (criticalSensors.length === 0) return;

    // Create a unique key for this alert to prevent duplicate emails
    const alertKey = `${criticalSensors.join('-')}-${Math.floor(Date.now() / 60000)}`; // Per minute
    
    if (emailSentRef.current.has(alertKey)) {
      return; // Already sent this alert
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('send-alert', {
        body: {
          temperature: data.temperature,
          humidity: data.humidity,
          gas: data.gas,
          criticalSensors,
        },
      });

      if (error) {
        console.error('Failed to send alert:', error);
      } else {
        emailSentRef.current.add(alertKey);
        console.log('Critical alert sent:', response);
        toast.error(`Critical alert triggered for: ${criticalSensors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error sending critical alert:', error);
    }
  }, []);

  // Fetch latest data from ThingSpeak
  const fetchData = useCallback(async () => {
    try {
      const reading = await fetchLatestReading();
      
      if (reading && reading.entryId !== lastEntryIdRef.current) {
        lastEntryIdRef.current = reading.entryId;
        
        const newData: SensorData = {
          temperature: reading.temperature,
          humidity: reading.humidity,
          gas: reading.gas,
          timestamp: reading.timestamp,
        };

        setCurrentData(newData);
        setLastUpdate(new Date());
        setIsConnected(true);

        // Add to history
        const historyEntry: HistoryEntry = {
          id: `${reading.entryId}`,
          timestamp: reading.timestamp,
          temperature: reading.temperature,
          humidity: reading.humidity,
          gas: reading.gas,
        };

        setHistory(prev => {
          const exists = prev.some(h => h.id === historyEntry.id);
          if (exists) return prev;
          return [historyEntry, ...prev].slice(0, 1000);
        });

        // Calculate status
        const newStatus = getStatus(newData, thresholds);
        setStatus(newStatus);

        // Check for threshold breaches and log
        if (newStatus.temperature !== 'normal') {
          addLog('temperature', newData.temperature, 
            newStatus.temperature === 'critical' ? thresholds.temperature.critical : thresholds.temperature.warning,
            newStatus.temperature);
        }
        
        if (newStatus.humidity !== 'normal') {
          addLog('humidity', newData.humidity,
            newStatus.humidity === 'critical' ? thresholds.humidity.critical : thresholds.humidity.warning,
            newStatus.humidity);
        }
        
        if (newStatus.gas !== 'normal') {
          addLog('gas', newData.gas,
            newStatus.gas === 'critical' ? thresholds.gas.critical : thresholds.gas.warning,
            newStatus.gas);
        }

        // Send email alert if critical
        if (newStatus.overall === 'critical') {
          sendCriticalAlert(newData, newStatus);
        }
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      setIsConnected(false);
    }
  }, [thresholds, getStatus, addLog, sendCriticalAlert]);

  // Load historical data on mount
  useEffect(() => {
    const loadHistory = async () => {
      const readings = await fetchHistoricalReadings(100);
      
      if (readings.length > 0) {
        const historyEntries: HistoryEntry[] = readings.map(r => ({
          id: `${r.entryId}`,
          timestamp: r.timestamp,
          temperature: r.temperature,
          humidity: r.humidity,
          gas: r.gas,
        }));
        
        setHistory(historyEntries.reverse());
        
        // Set current data from most recent
        const latest = readings[readings.length - 1];
        if (latest) {
          lastEntryIdRef.current = latest.entryId;
          setCurrentData({
            temperature: latest.temperature,
            humidity: latest.humidity,
            gas: latest.gas,
            timestamp: latest.timestamp,
          });
          setLastUpdate(latest.timestamp);
          setIsConnected(true);
          
          const initialStatus = getStatus({
            temperature: latest.temperature,
            humidity: latest.humidity,
            gas: latest.gas,
            timestamp: latest.timestamp,
          }, thresholds);
          setStatus(initialStatus);
        }
      }
    };

    loadHistory();
  }, [getStatus, thresholds]);

  // Poll for new data every 15 seconds (matches ThingSpeak update rate)
  useEffect(() => {
    fetchData(); // Initial fetch
    
    const interval = setInterval(fetchData, 15000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const updateThresholds = useCallback((newThresholds: SensorThresholds) => {
    setThresholds(newThresholds);
    localStorage.setItem('sensorThresholds', JSON.stringify(newThresholds));
    
    // Recalculate status with new thresholds
    const newStatus = getStatus(currentData, newThresholds);
    setStatus(newStatus);
  }, [currentData, getStatus]);

  return (
    <SensorContext.Provider
      value={{
        currentData,
        thresholds,
        status,
        logs,
        history,
        updateThresholds,
        isConnected,
        lastUpdate,
      }}
    >
      {children}
    </SensorContext.Provider>
  );
};
