const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3089;

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

// **リアルタイムデータ取得**
app.get("/api/data/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT TOP 1 * FROM c WHERE c.device = @deviceId ORDER BY c.time DESC`,
      parameters: [{ name: "@deviceId", value: deviceId }],
    };
    const { resources: items } = await container.items.query(querySpec).fetchAll();

    if (items.length === 0) {
      return res.status(404).json({ error: `No data found for deviceId: ${deviceId}` });
    }

    const latestData = items[0];

    // Null や undefined の場合は 0 に置き換える
    latestData.Flow1 = latestData.Flow1 || 0;
    latestData.Flow2 = latestData.Flow2 || 0;
    latestData.tempC3 = latestData.tempC3 || 0;
    latestData.tempC4 = latestData.tempC4 || 0;

    res.status(200).json(latestData);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});


// **昨日の合計熱量**
app.get("/api/data/yesterday-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const startOfYesterday = new Date(now);
  startOfYesterday.setDate(now.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(startOfYesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  try {
    const totalHeatTransfer = await fetchHeatData(deviceId, startOfYesterday.toISOString(), endOfYesterday.toISOString());
    res.status(200).json({ yesterdayTotal: totalHeatTransfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **今日の合計熱量**
app.get("/api/data/today-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const totalHeatTransfer = await fetchHeatData(deviceId, startOfToday.toISOString(), now.toISOString());
    res.status(200).json({ todayTotal: totalHeatTransfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **リアルタイム熱量計算関数**
async function fetchHeatData(deviceId, startTime, endTime = null) {
  const database = client.database(databaseId);
  const container = database.container(containerId);

  let querySpec = {
    query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
            WHERE c.device = @deviceId AND c.time >= @startTime`,
    parameters: [
      { name: "@deviceId", value: deviceId },
      { name: "@startTime", value: startTime },
    ],
  };

  if (endTime) {
    querySpec.query += " AND c.time <= @endTime";
    querySpec.parameters.push({ name: "@endTime", value: endTime });
  }

  const { resources: items } = await container.items.query(querySpec).fetchAll();
  let totalHeatTransfer = 0;

  items.forEach((data) => {
    const flowRateLpm = (data.Flow1 || 0) + (data.Flow2 || 0);
    const deltaT = (data.tempC3 || 0) - (data.tempC4 || 0);
    const density = 1000; // kg/m³
    const specificHeat = 4186; // J/(kg·K)
    const flowRateM3s = flowRateLpm / (1000 * 60);
    const massFlowRate = flowRateM3s * density;
    totalHeatTransfer += (massFlowRate * specificHeat * deltaT) / 1000; // kW
  });

  return totalHeatTransfer.toFixed(2);
}

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
