const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

let cache = null;
let lastFetch = 0;

module.exports = async (req, res) => {
  // ✅ Enable CORS for Canva
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const now = Date.now();
  const cacheDuration = 5 * 60 * 1000; // 5 minutes

  if (cache && now - lastFetch < cacheDuration) {
    return res.status(200).json(cache);
  }

  try {
    const urls = [
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_NEW:inventory-data-bus1/getInventory?start=0&limit=100",
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_USED:inventory-data-bus1/getInventory?start=0&limit=100"
    ];

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "application/json",
      "Referer": "https://www.elizabethcitygmc.com/",
    };

    // ✅ Fetch both new + used feeds
    const responses = await Promise.all(
      urls.map(u =>
        fetch(u, { headers })
          .then(r => r.json())
          .catch(err => {
            console.error("Fetch failed for", u, err);
            return null;
          })
      )
    );

    let allVehicles = [];

    // ✅ Extract from pageInfo.trackingData (confirmed structure)
    for (const r of responses) {
      if (!r) continue;

      if (r.pageInfo && Array.isArray(r.pageInfo.trackingData)) {
        allVehicles.push(...r.pageInfo.trackingData);
      }
    }

    // ✅ Transform data into clean structure
    const vehicles = allVehicles.map(v => ({
      year: v.modelYear || "",
      make: "GMC",
      model: v.model || "",
      trim: v.trim || v.series || "",
      price: v.price || v.priceSelling || 0,
      mileage: v.odometer || 0,
      image: v.images?.[0]?.uri || "https://via.placeholder.com/400x250?text=GMC+Vehicle",
      vin: v.vin || "",
      stockNumber: v.stockNumber || "",
      cityMPG: v.cityFuelEfficiency || "",
      highwayMPG: v.highwayFuelEfficiency || ""
    }));

    const payload = { vehicles };

    cache = payload;
    lastFetch = now;

    res.status(200).json(payload);
  } catch (err) {
    console.error("Inventory fetch error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};
