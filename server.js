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

// 最新データ取得
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
        console.error("最新データの取得に失敗:", error);
        res.status(500).json({ error: "Failed to fetch latest data" });
    }
});

// 昨日の合計熱量
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
        res.status(500).json({ error: "Failed to fetch yesterday total" });
    }
});

// 今日の合計熱量
app.get("/api/data/today-total/:deviceId", async (req, res) => {
    const deviceId = req.params.deviceId;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    try {
        const totalHeatTransfer = await fetchHeatData(deviceId, startOfToday.toISOString(), now.toISOString());
        res.status(200).json({ todayTotal: totalHeatTransfer });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch today total" });
    }
});

// 月別合計熱量
app.get("/api/data/monthly-total/:deviceId/:year/:month", async (req, res) => {
    const { deviceId, year, month } = req.params;
    const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    try {
        const totalHeatTransfer = await fetchHeatData(deviceId, startDate.toISOString(), endDate.toISOString());
        res.status(200).json({ monthlyTotal: totalHeatTransfer });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch monthly total" });
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// ヘルパー関数: データ取得と熱量計算
async function fetchHeatData(deviceId, startTime, endTime) {
    try {
        const database = client.database(databaseId);
        const container = database.container(containerId);
        const querySpec = {
            query: `SELECT c.Flow1, c.Flow2, c.tempC3, c.tempC4 FROM c 
                    WHERE c.device = @deviceId AND c.time BETWEEN @startTime AND @endTime`,
            parameters: [
                { name: "@deviceId", value: deviceId },
                { name: "@startTime", value: startTime },
                { name: "@endTime", value: endTime }
            ],
        };

        const { resources: items } = await container.items.query(querySpec).fetchAll();
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

        return totalHeatTransfer.toFixed(2);
    } catch (error) {
        console.error("熱量データの取得エラー:", error);
        throw new Error("Failed to fetch heat transfer data");
    }
}
