const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

let cache = null;
let lastFetch = 0;

module.exports = async (req, res) => {
  // ✅ Allow Canva & browsers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle browser preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (cache && now - lastFetch < fiveMinutes) {
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
      urls.map((u) =>
        fetch(u, { headers })
          .then((r) => r.json())
          .catch(() => null)
      )
    );

    const allVehicles = [];

    // ✅ Handle various nesting structures
    for (const r of responses) {
      if (!r) continue;

      if (Array.isArray(r.trackingData)) {
        allVehicles.push(...r.trackingData);
      } else if (Array.isArray(r.pageInfo?.trackingData)) {
        allVehicles.push(...r.pageInfo.trackingData);
      } else if (Array.isArray(r.pageInfo?.results)) {
        allVehicles.push(...r.pageInfo.results);
      } else if (Array.isArray(r.searchResults?.results)) {
        allVehicles.push(...r.searchResults.results);
      } else if (Array.isArray(r.results)) {
        allVehicles.push(...r.results);
      } else if (Array.isArray(r.vehicles)) {
        allVehicles.push(...r.vehicles);
      } else if (r.pageInfo && Array.isArray(r.pageInfo?.inventory || r.pageInfo?.data)) {
        allVehicles.push(...(r.pageInfo.inventory || r.pageInfo.data));
      }
    }

    // ✅ Extract relevant data
    const vehicles = allVehicles.map((v) => ({
      year: v.modelYear || "",
      make: "GMC",
      model: v.model || v.modelName || "",
      trim: v.trim || v.series || "",
      price: v.price || v.priceSelling || 0,
      mileage: v.odometer || 0,
      image:
        v.images?.[0]?.uri ||
        v.image ||
        "https://via.placeholder.com/400x250?text=GMC+Vehicle",
      vin: v.vin || "",
      stockNumber: v.stockNumber || "",
      cityMPG: v.cityFuelEfficiency || "",
      highwayMPG: v.highwayFuelEfficiency || "",
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
