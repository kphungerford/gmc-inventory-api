const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

let cache = null;
let lastFetch = 0;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const now = Date.now();
  const cacheDuration = 5 * 60 * 1000; // 5 min cache

  if (cache && now - lastFetch < cacheDuration) {
    return res.status(200).json(cache);
  }

  try {
    const urls = [
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_NEW:inventory-data-bus1/getInventory?start=0&limit=100",
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_USED:inventory-data-bus1/getInventory?start=0&limit=100",
    ];

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "application/json",
      Referer: "https://www.elizabethcitygmc.com/",
    };

    const responses = await Promise.all(
      urls.map(async (u) => {
        try {
          const r = await fetch(u, { headers });
          const text = await r.text();

          // 🔍 Look for the first and last curly braces to isolate JSON
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start === -1 || end === -1) {
            console.warn("No JSON structure found in dealer response.");
            return null;
          }

          const jsonText = text.slice(start, end + 1);

          // 🧠 Remove any HTML tags that might break parsing
          const cleaned = jsonText.replace(/<[^>]*>/g, "");

          try {
            return JSON.parse(cleaned);
          } catch (err) {
            console.error("JSON parse failed:", err);
            console.error("Snippet:", cleaned.slice(0, 300));
            return null;
          }
        } catch (err) {
          console.error("Fetch error for", u, err);
          return null;
        }
      })
    );

    const allVehicles = [];

    for (const r of responses) {
      if (!r) continue;
      if (r.pageInfo?.trackingData && Array.isArray(r.pageInfo.trackingData)) {
        allVehicles.push(...r.pageInfo.trackingData);
      }
    }

    const vehicles = allVehicles.map((v) => ({
      year: v.modelYear || "",
      make: "GMC",
      model: v.model || "",
      trim: v.trim || v.series || "",
      price: v.price || v.priceSelling || 0,
      mileage: v.odometer || 0,
      image:
        v.images?.[0]?.uri ||
        "https://via.placeholder.com/400x250?text=GMC+Vehicle",
      vin: v.vin || "",
      stockNumber: v.stockNumber || "",
      cityMPG: v.cityFuelEfficiency || "",
      highwayMPG: v.highwayFuelEfficiency || "",
    }));

    const payload = {
      vehicles,
      lastUpdated: new Date().toISOString(),
      count: vehicles.length,
    };

    cache = payload;
    lastFetch = now;

    res.status(200).json(payload);
  } catch (err) {
    console.error("Inventory fetch error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};
