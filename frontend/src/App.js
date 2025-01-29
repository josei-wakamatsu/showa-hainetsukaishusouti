import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [latestItem, setLatestItem] = useState(null);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [fiveMinutesTotal, setFiveMinutesTotal] = useState(0);
  const [hourlyTotal, setHourlyTotal] = useState(0);
  const [error, setError] = useState("");

  // Render のバックエンド URL
  const backendUrl = "https://hainetukaishusouti.onrender.com"; // RenderのURLに置き換えてください

  useEffect(() => {
    // 最新データ取得関数
    const fetchLatestData = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/data/hainetukaishu`);
        const latestData = response.data;

        // Flow1 + Flow2 を計算
        const flowRateLpm = latestData.Flow1 + latestData.Flow2;

        // 温度差 (TempC3 - TempC4) を計算
        const deltaT = latestData.tempC3 - latestData.tempC4;

        // 固定値
        const density = 1000; // kg/m³
        const specificHeat = 4186; // J/(kg·K)

        // 流量を m³/s に変換
        const flowRateM3s = flowRateLpm / (1000 * 60);

        // 質量流量を計算 (kg/s)
        const massFlowRate = flowRateM3s * density;

        // 熱量を計算 (W)
        const heatTransfer = massFlowRate * specificHeat * deltaT;

        setLatestItem({
          ...latestData,
          flowRateLpm: flowRateLpm.toFixed(2),
          deltaT: deltaT.toFixed(2),
          heatTransfer: (heatTransfer / 1000).toFixed(2), // kW単位
        });

        setError("");
      } catch (error) {
        setError("Failed to fetch latest data. " + error.message);
      }
    };

    // 合計データ取得関数
    const fetchTotals = async () => {
      try {
        const [dailyRes, fiveMinRes, hourlyRes] = await Promise.all([
          axios.get(`${backendUrl}/api/data/daily-total/hainetukaishu`),
          axios.get(`${backendUrl}/api/data/five-minutes-total/hainetukaishu`),
          axios.get(`${backendUrl}/api/data/hourly-total/hainetukaishu`),
        ]);

        setDailyTotal(dailyRes.data.dailyTotal);
        setFiveMinutesTotal(fiveMinRes.data.fiveMinutesTotal);
        setHourlyTotal(hourlyRes.data.hourlyTotal);
      } catch (error) {
        console.error("Failed to fetch totals:", error);
      }
    };

    // 初回データ取得
    fetchLatestData();
    fetchTotals();

    // 5秒ごとにデータ更新
    const interval = setInterval(() => {
      fetchLatestData();
      fetchTotals();
    }, 5000);

    // クリーンアップ
    return () => clearInterval(interval);
  }, [backendUrl]);

  return (
    <div>
      <h1>Real-Time Device Data Viewer</h1>
      {error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <>
          {/* 最新のデータ表示 */}
          {latestItem && (
            <div style={{ marginBottom: "20px", border: "1px solid black", padding: "10px" }}>
              <h2>Latest Data</h2>
              <p><strong>Flow Rate (L/min):</strong> {latestItem.flowRateLpm}</p>
              <p><strong>Temperature Difference (TempC3 - TempC4):</strong> {latestItem.deltaT} °C</p>
              <p><strong>Heat Transfer:</strong> {latestItem.heatTransfer} kW</p>
            </div>
          )}

          {/* 合計データの表示 */}
          <div style={{ marginTop: "20px", border: "1px solid black", padding: "10px" }}>
            <h2>Cumulative Data</h2>
            <p><strong>Five Minutes Total:</strong> {fiveMinutesTotal.toFixed(2)} kW</p>
            <p><strong>Hourly Total:</strong> {hourlyTotal.toFixed(2)} kW</p>
            <p><strong>Daily Total:</strong> {dailyTotal.toFixed(2)} kW</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
