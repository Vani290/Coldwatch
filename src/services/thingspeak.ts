// ThingSpeak API Service for Cold Storage Monitoring
// Channel: 3186649
// Field 1: Temperature, Field 2: Humidity, Field 3: Gas
// Field 4: Temp Warning, Field 5: Temp Critical, Field 6: Humidity Warning, Field 7: Humidity Critical, Field 8: Gas Warning

const THINGSPEAK_CHANNEL_ID = "3186649";
const THINGSPEAK_READ_API_KEY = "1Q662QYR5B6OC2J7";
const THINGSPEAK_WRITE_API_KEY = "2C8NMJXWK4Y3J7FK";

export interface ThingSpeakFeed {
  created_at: string;
  entry_id: number;
  field1: string | null; // Temperature
  field2: string | null; // Humidity
  field3: string | null; // Gas
  field4: string | null; // Temp Warning Threshold
  field5: string | null; // Temp Critical Threshold
  field6: string | null; // Humidity Warning Threshold
  field7: string | null; // Humidity Critical Threshold
  field8: string | null; // Gas Warning Threshold (Gas Critical can be derived or stored elsewhere)
}

export interface ThingSpeakResponse {
  channel: {
    id: number;
    name: string;
    latitude: string;
    longitude: string;
    field1: string;
    field2: string;
    field3: string;
    created_at: string;
    updated_at: string;
    last_entry_id: number;
  };
  feeds: ThingSpeakFeed[];
}

export interface SensorReading {
  temperature: number;
  humidity: number;
  gas: number;
  timestamp: Date;
  entryId: number;
}

export interface ThresholdSync {
  tempWarning: number;
  tempCritical: number;
  humidityWarning: number;
  humidityCritical: number;
  gasWarning: number;
  gasCritical: number;
}

// Fetch the latest sensor reading
export async function fetchLatestReading(): Promise<SensorReading | null> {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_READ_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("ThingSpeak API error:", response.status);
      return null;
    }
    
    const data: ThingSpeakFeed = await response.json();
    
    if (!data || !data.created_at) {
      console.error("Invalid ThingSpeak response:", data);
      return null;
    }
    
    return {
      temperature: parseFloat(data.field1 || "0"),
      humidity: parseFloat(data.field2 || "0"),
      gas: parseInt(data.field3 || "0", 10),
      timestamp: new Date(data.created_at),
      entryId: data.entry_id,
    };
  } catch (error) {
    console.error("Error fetching ThingSpeak data:", error);
    return null;
  }
}

// Fetch historical readings (last N entries)
export async function fetchHistoricalReadings(results: number = 100): Promise<SensorReading[]> {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_API_KEY}&results=${results}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("ThingSpeak API error:", response.status);
      return [];
    }
    
    const data: ThingSpeakResponse = await response.json();
    
    if (!data.feeds || !Array.isArray(data.feeds)) {
      console.error("Invalid ThingSpeak response:", data);
      return [];
    }
    
    return data.feeds.map(feed => ({
      temperature: parseFloat(feed.field1 || "0"),
      humidity: parseFloat(feed.field2 || "0"),
      gas: parseInt(feed.field3 || "0", 10),
      timestamp: new Date(feed.created_at),
      entryId: feed.entry_id,
    })).reverse(); // Most recent last for charts
  } catch (error) {
    console.error("Error fetching ThingSpeak history:", error);
    return [];
  }
}

// Fetch readings from a specific time range
export async function fetchReadingsInRange(
  startDate: Date,
  endDate: Date
): Promise<SensorReading[]> {
  try {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_API_KEY}&start=${start}&end=${end}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("ThingSpeak API error:", response.status);
      return [];
    }
    
    const data: ThingSpeakResponse = await response.json();
    
    if (!data.feeds || !Array.isArray(data.feeds)) {
      return [];
    }
    
    return data.feeds.map(feed => ({
      temperature: parseFloat(feed.field1 || "0"),
      humidity: parseFloat(feed.field2 || "0"),
      gas: parseInt(feed.field3 || "0", 10),
      timestamp: new Date(feed.created_at),
      entryId: feed.entry_id,
    }));
  } catch (error) {
    console.error("Error fetching ThingSpeak range data:", error);
    return [];
  }
}

// Sync thresholds to ThingSpeak for ESP32 to read
// Uses fields 4-8 to store threshold values
export async function syncThresholdsToThingSpeak(thresholds: ThresholdSync): Promise<boolean> {
  try {
    const url = `https://api.thingspeak.com/update?api_key=${THINGSPEAK_WRITE_API_KEY}&field4=${thresholds.tempWarning}&field5=${thresholds.tempCritical}&field6=${thresholds.humidityWarning}&field7=${thresholds.humidityCritical}&field8=${thresholds.gasWarning}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("ThingSpeak sync error:", response.status);
      return false;
    }
    
    const entryId = await response.text();
    
    // ThingSpeak returns 0 if the update failed (rate limit or error)
    if (entryId === "0") {
      console.warn("ThingSpeak rate limit - try again in 15 seconds");
      return false;
    }
    
    console.log("Thresholds synced to ThingSpeak, entry:", entryId);
    return true;
  } catch (error) {
    console.error("Error syncing thresholds:", error);
    return false;
  }
}
