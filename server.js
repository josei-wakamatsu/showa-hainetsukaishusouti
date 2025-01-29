const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3099;

// Cosmos DB 接続情報
const endpoint = process.env.COSMOSDB_ENDPOINT;
const key = process.env.COSMOSDB_KEY;
const client = new CosmosClient({ endpoint, key });
const databaseId = process.env.DATABASE_ID;
const containerId = process.env.CONTAINER_ID;

// ミドルウェア
app.use(cors());
app.use(express.json());

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, "frontend/build")));

// ルートエンドポイント
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// **共通のデータ取得関数**
async function fetchHeatData(deviceId, startTime, endTime = null) {
  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    let querySpec = {
      query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
              WHERE c.device = @deviceId AND c.time >= @startTime` + 
              (endTime ? " AND c.time <= @endTime" : ""),
      parameters: [{ name: "@deviceId", value: deviceId }, { name: "@startTime", value: startTime }],
    };

    if (endTime) querySpec.parameters.push({ name: "@endTime", value: endTime });

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return calculateTotalHeat(items);
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("Failed to fetch data");
  }
}

// **共通の熱量計算関数**
function calculateTotalHeat(items) {
  let totalHeatTransfer = 0;
  items.forEach((data) => {
    const flowRateLpm = data.Flow1 + data.Flow2;
    const deltaT = data.tempC3 - data.tempC4;
    const density = 1000;
    const specificHeat = 4186;
    const flowRateM3s = flowRateLpm / (1000 * 60);
    const massFlowRate = flowRateM3s * density;
    totalHeatTransfer += (massFlowRate * specificHeat * deltaT) / 1000;
  });
  return totalHeatTransfer.toFixed(2);
}

// **5分前の合計熱量**
app.get("/api/data/five-minutes-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  try {
    const totalHeatTransfer = await fetchHeatData(deviceId, fiveMinutesAgo);
    res.status(200).json({ fiveMinutesTotal: totalHeatTransfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **1時間前の合計熱量**
app.get("/api/data/hourly-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  try {
    const totalHeatTransfer = await fetchHeatData(deviceId, oneHourAgo);
    res.status(200).json({ hourlyTotal: totalHeatTransfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **昨日の合計熱量**
app.get("/api/data/daily-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const startOfYesterday = new Date(now);
  startOfYesterday.setDate(now.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(startOfYesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  try {
    const totalHeatTransfer = await fetchHeatData(deviceId, startOfYesterday.toISOString(), endOfYesterday.toISOString());
    res.status(200).json({ dailyTotal: totalHeatTransfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **サーバー起動**
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
