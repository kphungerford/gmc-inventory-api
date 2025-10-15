// Elizabeth City GMC Inventory API Bridge
// This combines new + used inventory feeds into one API response

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let cache = null;
let lastFetch = 0;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // later replace '*' with your site
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const now = Date.now();
  const cacheTime = 5 * 60 * 1000; // 5 minutes

  // use cache if still fresh
  if (cache && now - lastFetch < cacheTime) {
    return res.status(200).json(cache);
  }

  try {
    const urls = [
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_NEW:inventory-data-bus1/getInventory?start=0&limit=100",
      "https://www.elizabethcitygmc.com/apis/widget/INVENTORY_LISTING_DEFAULT_AUTO_USED:inventory-data-bus1/getInventory?start=0&limit=100"
    ];

    const results = await Promise.all(urls.map(u => fetch(u).then(r => r.json())));
    const vehicles = [
      ...(results[0]?.searchResults?.results || []),
      ...(results[1]?.searchResults?.results || [])
    ];

    const payload = { vehicles };
    cache = payload;
    lastFetch = now;

    res.status(200).json(payload);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};
