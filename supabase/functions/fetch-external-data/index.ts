import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  type: "stock" | "crypto" | "weather" | "random";
  symbol?: string;
  city?: string;
  min?: number;
  max?: number;
  count?: number;
}

interface FetchResult {
  data: unknown;
  timestamp: string;
  error?: string;
}

// Simulated stock data using deterministic pseudo-random based on date and symbol
function fetchStock(symbol: string): FetchResult {
  const now = new Date();
  const timestamp = now.toISOString();
  
  // Base prices for common stocks (simulated)
  const basePrices: Record<string, number> = {
    AAPL: 185.0,
    GOOGL: 140.0,
    MSFT: 420.0,
    AMZN: 185.0,
    TSLA: 250.0,
    META: 500.0,
    NVDA: 880.0,
    JPM: 195.0,
    V: 280.0,
    WMT: 165.0,
  };

  const basePrice = basePrices[symbol.toUpperCase()] || 100.0;
  
  // Add daily variation based on date (±5%)
  const dayHash = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const symbolHash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variation = (((dayHash * symbolHash) % 1000) / 1000 - 0.5) * 0.1;
  
  const price = Number((basePrice * (1 + variation)).toFixed(2));
  
  return {
    data: {
      symbol: symbol.toUpperCase(),
      price,
      timestamp,
      currency: "USD",
    },
    timestamp,
  };
}

// Simulated crypto data
function fetchCrypto(symbol: string): FetchResult {
  const now = new Date();
  const timestamp = now.toISOString();
  
  const basePrices: Record<string, number> = {
    BTC: 95000.0,
    ETH: 3400.0,
    SOL: 180.0,
    XRP: 2.2,
    DOGE: 0.35,
    ADA: 0.95,
    DOT: 7.5,
    AVAX: 38.0,
    LINK: 22.0,
    MATIC: 0.85,
  };

  const basePrice = basePrices[symbol.toUpperCase()] || 100.0;
  
  // Higher volatility for crypto (±10%)
  const dayHash = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const symbolHash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variation = (((dayHash * symbolHash) % 1000) / 1000 - 0.5) * 0.2;
  
  const price = Number((basePrice * (1 + variation)).toFixed(symbol === "BTC" ? 2 : 4));
  
  return {
    data: {
      symbol: symbol.toUpperCase(),
      price,
      timestamp,
      currency: "USD",
    },
    timestamp,
  };
}

// Simulated weather data
function fetchWeather(city: string): FetchResult {
  const now = new Date();
  const timestamp = now.toISOString();
  
  // Base temperatures for cities (in Fahrenheit)
  const baseTemps: Record<string, number> = {
    "new york": 45,
    "los angeles": 68,
    "chicago": 38,
    "houston": 62,
    "phoenix": 72,
    "london": 48,
    "paris": 50,
    "tokyo": 52,
    "sydney": 75,
    "dubai": 82,
  };

  const cityLower = city.toLowerCase();
  const baseTemp = baseTemps[cityLower] || 55;
  
  // Add daily variation (±10°F)
  const dayHash = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const cityHash = city.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variation = (((dayHash * cityHash) % 1000) / 1000 - 0.5) * 20;
  
  const tempF = Math.round(baseTemp + variation);
  const tempC = Math.round((tempF - 32) * 5 / 9);
  
  const conditions = ["sunny", "cloudy", "partly cloudy", "rainy", "overcast"];
  const conditionIndex = (dayHash + cityHash) % conditions.length;
  
  return {
    data: {
      city: city.charAt(0).toUpperCase() + city.slice(1),
      temp_f: tempF,
      temp_c: tempC,
      conditions: conditions[conditionIndex],
      humidity: 40 + ((dayHash * cityHash) % 40),
      timestamp,
    },
    timestamp,
  };
}

// Random number generator
function fetchRandom(min: number, max: number, count: number): FetchResult {
  const timestamp = new Date().toISOString();
  
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const val = min + Math.random() * (max - min);
    values.push(Number(val.toFixed(4)));
  }
  
  return {
    data: count === 1 ? values[0] : values,
    timestamp,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: FetchRequest = await req.json();
    
    let result: FetchResult;
    
    switch (body.type) {
      case "stock":
        if (!body.symbol) {
          return new Response(
            JSON.stringify({ error: "Symbol required for stock fetch" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = fetchStock(body.symbol);
        break;
        
      case "crypto":
        if (!body.symbol) {
          return new Response(
            JSON.stringify({ error: "Symbol required for crypto fetch" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = fetchCrypto(body.symbol);
        break;
        
      case "weather":
        if (!body.city) {
          return new Response(
            JSON.stringify({ error: "City required for weather fetch" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = fetchWeather(body.city);
        break;
        
      case "random":
        result = fetchRandom(
          body.min ?? 0,
          body.max ?? 100,
          body.count ?? 1
        );
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: "Invalid fetch type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Fetched ${body.type} data:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Fetch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
