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

// 最新データの取得（null 値の処理を追加）
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

    // null 値を 0 に置き換え
    const flow1 = latestData.Flow1 ?? 0;
    const flow2 = latestData.Flow2 ?? 0;
    const tempC3 = latestData.tempC3 ?? 0;
    const tempC4 = latestData.tempC4 ?? 0;

    res.status(200).json({ Flow1: flow1, Flow2: flow2, tempC3, tempC4 });
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

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    let totalHeatTransfer = 0;

    items.forEach((data) => {
      const flowRateLpm = (data.Flow1 ?? 0) + (data.Flow2 ?? 0);
      const deltaT = (data.tempC3 ?? 0) - (data.tempC4 ?? 0);
      const density = 1000;
      const specificHeat = 4186;
      const flowRateM3s = flowRateLpm / (1000 * 60);
      const massFlowRate = flowRateM3s * density;
      totalHeatTransfer += (massFlowRate * specificHeat * deltaT) / 1000;
    });

    res.status(200).json({ fiveMinutesTotal: totalHeatTransfer.toFixed(2) });
  } catch (error) {
    console.error("Error fetching five minutes total:", error);
    res.status(500).json({ error: "Failed to fetch five minutes total" });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
