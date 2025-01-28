const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3098;

// デバッグ用: 環境変数の確認
console.log("Environment Variables:");
console.log("COSMOSDB_ENDPOINT:", process.env.COSMOSDB_ENDPOINT);
console.log("COSMOSDB_KEY:", process.env.COSMOSDB_KEY);
console.log("DATABASE_ID:", process.env.DATABASE_ID);
console.log("CONTAINER_ID:", process.env.CONTAINER_ID);

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

// その他の API エンドポイント
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
    res.status(200).json(items[0]);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// デバッグ用: 404用エンドポイント
app.get("*", (req, res) => {
  console.log(`404 Error for URL: ${req.url}`);
  res.sendFile(path.join(__dirname, "frontend/build", "index.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
