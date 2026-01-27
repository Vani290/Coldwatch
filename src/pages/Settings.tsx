import React, { useState } from 'react';
import { Save, RotateCcw, Thermometer, Droplets, Wind, CloudUpload } from 'lucide-react';
import { useSensorData } from '@/contexts/SensorContext';
import { SensorThresholds } from '@/types/sensor';
import { syncThresholdsToThingSpeak } from '@/services/thingspeak';
import { toast } from 'sonner';

const defaultThresholds: SensorThresholds = {
  temperature: { warning: 8, critical: 12 },
  humidity: { warning: 70, critical: 85 },
  gas: { warning: 300, critical: 500 },
};

const Settings: React.FC = () => {
  const { thresholds, updateThresholds } = useSensorData();
  const [formData, setFormData] = useState<SensorThresholds>(thresholds);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleChange = (
    sensor: keyof SensorThresholds,
    level: 'warning' | 'critical',
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        [level]: parseFloat(value) || 0,
      },
    }));
  };

  const handleSave = async () => {
    updateThresholds(formData);
    toast.success('Thresholds updated locally');
    
    // Sync to ThingSpeak for ESP32
    setIsSyncing(true);
    const synced = await syncThresholdsToThingSpeak({
      tempWarning: formData.temperature.warning,
      tempCritical: formData.temperature.critical,
      humidityWarning: formData.humidity.warning,
      humidityCritical: formData.humidity.critical,
      gasWarning: formData.gas.warning,
      gasCritical: formData.gas.critical,
    });
    setIsSyncing(false);
    
    if (synced) {
      toast.success('Thresholds synced to ESP32 via ThingSpeak');
    } else {
      toast.warning('Local save successful. ESP32 sync will retry in 15s (rate limit)');
    }
  };

  const handleReset = async () => {
    setFormData(defaultThresholds);
    updateThresholds(defaultThresholds);
    toast.success('Thresholds reset to defaults');
    
    // Sync defaults to ThingSpeak
    setIsSyncing(true);
    await syncThresholdsToThingSpeak({
      tempWarning: defaultThresholds.temperature.warning,
      tempCritical: defaultThresholds.temperature.critical,
      humidityWarning: defaultThresholds.humidity.warning,
      humidityCritical: defaultThresholds.humidity.critical,
      gasWarning: defaultThresholds.gas.warning,
      gasCritical: defaultThresholds.gas.critical,
    });
    setIsSyncing(false);
  };

  return (
    <div className="h-full p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure sensor thresholds and alerts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-muted-foreground rounded-lg font-medium hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <CloudUpload className="w-4 h-4 animate-pulse" />
                Syncing to ESP32...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save & Sync
              </>
            )}
          </button>
        </div>
      </div>

      {/* Threshold Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Temperature */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-chart-temperature/10">
              <Thermometer className="w-6 h-6 text-chart-temperature" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Temperature</h3>
              <p className="text-sm text-muted-foreground">Set temperature thresholds (°C)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Warning Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.temperature.warning}
                  onChange={(e) => handleChange('temperature', 'warning', e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">°C</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Critical Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.temperature.critical}
                  onChange={(e) => handleChange('temperature', 'critical', e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">°C</span>
              </div>
            </div>
          </div>
        </div>

        {/* Humidity */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-chart-humidity/10">
              <Droplets className="w-6 h-6 text-chart-humidity" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Humidity</h3>
              <p className="text-sm text-muted-foreground">Set humidity thresholds (%)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Warning Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.humidity.warning}
                  onChange={(e) => handleChange('humidity', 'warning', e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Critical Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.humidity.critical}
                  onChange={(e) => handleChange('humidity', 'critical', e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gas */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-chart-gas/10">
              <Wind className="w-6 h-6 text-chart-gas" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Gas Level</h3>
              <p className="text-sm text-muted-foreground">Set gas thresholds (PPM)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Warning Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.gas.warning}
                  onChange={(e) => handleChange('gas', 'warning', e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">PPM</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Critical Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.gas.critical}
                  onChange={(e) => handleChange('gas', 'critical', e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">PPM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="glass-card p-4 border-l-4 border-primary">
        <h4 className="font-medium text-foreground mb-1">About Thresholds</h4>
        <p className="text-sm text-muted-foreground">
          <strong>Warning:</strong> Sensor readings above this value will trigger a yellow warning indicator.
          <br />
          <strong>Critical:</strong> Sensor readings above this value will trigger a red critical alert and notification.
        </p>
      </div>
    </div>
  );
};

export default Settings;
