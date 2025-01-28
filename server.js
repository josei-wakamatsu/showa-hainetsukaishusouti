const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");

const app = express();
const PORT = 3098;

// Cosmos DB 接続情報
// Cosmos DB データベースとコンテナ
const endpoint = process.env.COSMOSDB_ENDPOINT;
const key = process.env.COSMOSDB_KEY;
const client = new CosmosClient({ endpoint, key });
const databaseId = process.env.DATABASE_ID;
const containerId = process.env.CONTAINER_ID;


// ミドルウェア
app.use(cors());
app.use(express.json());

// 最新データ取得エンドポイント
app.get("/api/data/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const querySpec = {
      query: `
        SELECT TOP 1 * 
        FROM c 
        WHERE c.device = @deviceId 
        ORDER BY c.time DESC`,
      parameters: [{ name: "@deviceId", value: deviceId }],
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();

    if (items.length === 0) {
      return res.status(404).json({ error: `No data found for deviceId: ${deviceId}` });
    }

    res.status(200).json(items[0]);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// 5分間のデータ合計取得エンドポイント
app.get("/api/data/five-minutes-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const querySpec = {
      query: `
        SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4
        FROM c 
        WHERE c.device = @deviceId AND c.time >= @fiveMinutesAgo AND c.time <= @now`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@fiveMinutesAgo", value: fiveMinutesAgo.toISOString() },
        { name: "@now", value: now.toISOString() },
      ],
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    console.log("Five Minutes Raw Data:", items);

    // heatTransfer を計算
    const density = 1000; // kg/m³
    const specificHeat = 4186; // J/(kg·K)

    const totalHeatTransfer = items.reduce((sum, item) => {
      const flowRateLpm = item.Flow1 + item.Flow2; // L/min
      const deltaT = item.tempC3 - item.tempC4; // 温度差
      const flowRateM3s = flowRateLpm / (1000 * 60); // m³/s
      const massFlowRate = flowRateM3s * density; // kg/s
      const heatTransfer = massFlowRate * specificHeat * deltaT; // W

      return sum + heatTransfer;
    }, 0);

    res.status(200).json({ fiveMinutesTotal: totalHeatTransfer / 1000 }); // kW に変換
  } catch (error) {
    console.error("Error fetching five minutes total:", error);
    res.status(500).json({ error: "Failed to fetch five minutes total" });
  }
});


// 1時間のデータ合計取得エンドポイント
app.get("/api/data/hourly-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1時間前

    const querySpec = {
      query: `
        SELECT VALUE SUM(c.heatTransfer)
        FROM c 
        WHERE c.device = @deviceId AND c.time >= @oneHourAgo AND c.time <= @now`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@oneHourAgo", value: oneHourAgo.toISOString() },
        { name: "@now", value: now.toISOString() },
      ],
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    res.status(200).json({ hourlyTotal: resources[0] || 0 });
  } catch (error) {
    console.error("Error fetching hourly total:", error);
    res.status(500).json({ error: "Failed to fetch hourly total" });
  }
});

// 日合計のデータ取得エンドポイント
app.get("/api/data/daily-total/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;

  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今日の0時
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // 明日の0時

    const querySpec = {
      query: `
        SELECT VALUE SUM(c.heatTransfer)
        FROM c 
        WHERE c.device = @deviceId AND c.time >= @today AND c.time < @tomorrow`,
      parameters: [
        { name: "@deviceId", value: deviceId },
        { name: "@today", value: today.toISOString() },
        { name: "@tomorrow", value: tomorrow.toISOString() },
      ],
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    res.status(200).json({ dailyTotal: resources[0] || 0 });
  } catch (error) {
    console.error("Error fetching daily total:", error);
    res.status(500).json({ error: "Failed to fetch daily total" });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
