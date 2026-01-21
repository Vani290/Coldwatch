import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLD_STORAGE_SYSTEM_PROMPT = `You are ColdWatch AI, an expert assistant for cold storage monitoring systems. You have deep knowledge about:

## Cold Storage Monitoring
- Temperature monitoring with DHT11 sensors (optimal range: -2°C to 8°C for most cold storage)
- Humidity monitoring (typically 85-95% RH for cold storage)
- Gas detection with MQ2 sensors (detects LPG, propane, hydrogen, methane, smoke)
- ThingSpeak cloud integration for data logging

## Sensor Knowledge
**DHT11 Sensor:**
- Temperature range: 0-50°C with ±2°C accuracy
- Humidity range: 20-90% RH with ±5% accuracy
- Sampling rate: 1Hz (once per second)

**MQ2 Gas Sensor:**
- Detects: LPG, propane, hydrogen, methane, alcohol, smoke
- Range: 200-10000 ppm
- Warm-up time: 20 seconds minimum

## Cold Storage Best Practices
- Maintain consistent temperatures to prevent spoilage
- Monitor humidity to prevent frost buildup and dehydration
- Gas detection for safety (refrigerant leaks, fires)
- Regular calibration of sensors
- Quick response to threshold breaches

## Alert Thresholds
- Temperature warnings: ±2°C from setpoint, critical: ±5°C
- Humidity warnings: ±5% from setpoint, critical: ±10%
- Gas detection: Any significant reading requires investigation

When users provide current sensor data, analyze it and provide actionable insights. Be helpful, concise, and focus on practical advice for maintaining optimal cold storage conditions.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sensorData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context with current sensor data if provided
    let systemPrompt = COLD_STORAGE_SYSTEM_PROMPT;
    if (sensorData) {
      systemPrompt += `\n\n## Current Sensor Readings
- Temperature: ${sensorData.temperature}°C (Status: ${sensorData.temperatureStatus})
- Humidity: ${sensorData.humidity}% (Status: ${sensorData.humidityStatus})
- Gas Level: ${sensorData.gas} PPM (Status: ${sensorData.gasStatus})
- Last Updated: ${sensorData.lastUpdate}

## Current Thresholds
Temperature: Warning at ${sensorData.thresholds?.temperature?.warning}°C, Critical at ${sensorData.thresholds?.temperature?.critical}°C
Humidity: Warning at ${sensorData.thresholds?.humidity?.warning}%, Critical at ${sensorData.thresholds?.humidity?.critical}%
Gas: Warning at ${sensorData.thresholds?.gas?.warning} PPM, Critical at ${sensorData.thresholds?.gas?.critical} PPM`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
