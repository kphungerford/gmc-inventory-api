const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

let cache = null;
let lastFetch = 0;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (cache && now - lastFetch < fiveMinutes) {
    return res.status(200).json(cache);
  }

  try {
    const urls = [
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_NEW:inventory-data-bus1/getInventory?start=0&limit=100",
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_USED:inventory-data-bus1/getInventory?start=0&limit=100"
    ];

    // Add browser-like headers
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "application/json",
      "Referer": "https://www.elizabethcitygmc.com/",
    };

    const responses = await Promise.all(
      urls.map(u => fetch(u, { headers }).then(r => r.json()).catch(() => null))
    );

    const allVehicles = [];

    for (const r of responses) {
      if (!r) continue;
      if (r.searchResults?.results) allVehicles.push(...r.searchResults.results);
      else if (r.results) allVehicles.push(...r.results);
      else if (r.vehicles) allVehicles.push(...r.vehicles);
    }

    const payload = { vehicles: allVehicles };
    cache = payload;
    lastFetch = now;

    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};
