# ColdWatch - Cold Storage Monitoring System

Industrial-grade cold storage monitoring system for tracking temperature, humidity, and gas levels in real-time.

## Features

- **Real-time Monitoring**: Track temperature, humidity, and gas levels from ThingSpeak sensors
- **Threshold Alerts**: Get instant notifications when sensor readings exceed safe limits
- **Email Alerts**: Automatic email notifications for critical conditions
- **Historical Data**: View and analyze historical sensor data
- **ESP32 Integration**: Sync thresholds with ESP32 hardware via ThingSpeak

## Tech Stack

- React + TypeScript
- Tailwind CSS
- Firebase Authentication
- ThingSpeak IoT Platform
- Supabase Edge Functions

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Configuration

The application connects to ThingSpeak channel 3240300 for sensor data. Thresholds can be configured in the Settings page and will sync to the ESP32 hardware.
