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

// 最新データの取得
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

    if (!items.length) {
      console.error(`No data found for deviceId: ${deviceId}`);
      return res.status(404).json({ error: "No data found" });
    }

    console.log("Fetched data:", items[0]); // デバッグ用
    res.status(200).json(items[0]);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// 5分前の合計熱量
app.get("/api/data/five-minutes-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
              WHERE c.device = @deviceId AND c.time >= @startTime`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@startTime", value: fiveMinutesAgo },
      ],
    };

    console.log(`Fetching data from ${fiveMinutesAgo} for device ${deviceId}`);

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    let totalHeatTransfer = calculateTotalHeat(items);

    res.status(200).json({ fiveMinutesTotal: totalHeatTransfer.toFixed(2) });
  } catch (error) {
    console.error("Error fetching five minutes total:", error);
    res.status(500).json({ error: "Failed to fetch five minutes total" });
  }
});

// 1時間前の合計熱量
app.get("/api/data/hourly-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
              WHERE c.device = @deviceId AND c.time >= @startTime`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@startTime", value: oneHourAgo },
      ],
    };

    console.log(`Fetching data from ${oneHourAgo} for device ${deviceId}`);

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    let totalHeatTransfer = calculateTotalHeat(items);

    res.status(200).json({ hourlyTotal: totalHeatTransfer.toFixed(2) });
  } catch (error) {
    console.error("Error fetching hourly total:", error);
    res.status(500).json({ error: "Failed to fetch hourly total" });
  }
});

// 昨日の合計熱量
app.get("/api/data/daily-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const now = new Date();
  const startOfYesterday = new Date(now);
  startOfYesterday.setDate(now.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(startOfYesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
              WHERE c.device = @deviceId AND c.time >= @startTime AND c.time <= @endTime`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@startTime", value: startOfYesterday.toISOString() },
        { name: "@endTime", value: endOfYesterday.toISOString() },
      ],
    };

    console.log(`Fetching data from ${startOfYesterday.toISOString()} to ${endOfYesterday.toISOString()} for device ${deviceId}`);

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    let totalHeatTransfer = calculateTotalHeat(items);

    res.status(200).json({ dailyTotal: totalHeatTransfer.toFixed(2) });
  } catch (error) {
    console.error("Error fetching daily total:", error);
    res.status(500).json({ error: "Failed to fetch daily total" });
  }
});

// **共通の熱量計算関数**
function calculateTotalHeat(items) {
  let totalHeatTransfer = 0;
  items.forEach((data) => {
    const flowRateLpm = (data.Flow1 || 0) + (data.Flow2 || 0);
    const deltaT = (data.tempC3 || 0) - (data.tempC4 || 0);
    const density = 1000;
    const specificHeat = 4186;
    const flowRateM3s = flowRateLpm / (1000 * 60);
    const massFlowRate = flowRateM3s * density;
    totalHeatTransfer += (massFlowRate * specificHeat * deltaT) / 1000;
  });
  return totalHeatTransfer;
}

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
