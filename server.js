const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3098;

// Cosmos DB 接続情報
const endpoint = process.env.COSMOSDB_ENDPOINT;
const key = process.env.COSMOSDB_KEY;
const client = new CosmosClient({ endpoint, key });
const databaseId = process.env.DATABASE_ID;
const containerId = process.env.CONTAINER_ID;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend/build")));

// 時間範囲を取得する関数
const getTimeRange = (minutes) => {
  const now = new Date();
  const startTime = new Date(now.getTime() - minutes * 60 * 1000);
  return { startTime: startTime.toISOString(), endTime: now.toISOString() };
};

// 5分間のデータ取得
app.get("/api/data/5min/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const { startTime, endTime } = getTimeRange(5);

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
              WHERE c.device = @deviceId AND c.time >= @startTime AND c.time <= @endTime`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@startTime", value: startTime },
        { name: "@endTime", value: endTime },
      ],
    };

    console.log(`Fetching 5 min data from ${startTime} to ${endTime}`);

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    const totalHeat = calculateHeat(items);
    res.status(200).json({ heatTransfer: totalHeat });
  } catch (error) {
    console.error("Error fetching 5 min data:", error);
    res.status(500).json({ error: "Failed to fetch 5 min data" });
  }
});

// 1時間のデータ取得
app.get("/api/data/1hour/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  const { startTime, endTime } = getTimeRange(60);

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
              WHERE c.device = @deviceId AND c.time >= @startTime AND c.time <= @endTime`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@startTime", value: startTime },
        { name: "@endTime", value: endTime },
      ],
    };

    console.log(`Fetching 1 hour data from ${startTime} to ${endTime}`);

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    const totalHeat = calculateHeat(items);
    res.status(200).json({ heatTransfer: totalHeat });
  } catch (error) {
    console.error("Error fetching 1 hour data:", error);
    res.status(500).json({ error: "Failed to fetch 1 hour data" });
  }
});

// 前日1日分のデータ取得
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

    console.log(`Fetching daily total data from ${startOfYesterday.toISOString()} to ${endOfYesterday.toISOString()}`);

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    const totalHeat = calculateHeat(items);
    res.status(200).json({ dailyTotal: totalHeat });
  } catch (error) {
    console.error("Error fetching daily total:", error);
    res.status(500).json({ error: "Failed to fetch daily total" });
  }
});

// 熱量計算関数
const calculateHeat = (items) => {
  let totalHeatTransfer = 0;
  items.forEach((data) => {
    const flowRateLpm = data.Flow1 + data.Flow2;
    const deltaT = data.tempC3 - data.tempC4;
    const density = 1000;  // 水の密度 (kg/m^3)
    const specificHeat = 4186; // 水の比熱 (J/kg・K)
    const flowRateM3s = flowRateLpm / (1000 * 60); // L/min → m^3/s
    const massFlowRate = flowRateM3s * density;
    totalHeatTransfer += (massFlowRate * specificHeat * deltaT) / 1000; // kJに変換
  });
  return totalHeatTransfer.toFixed(2);
};

// フロントエンドに対応
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/build", "index.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
