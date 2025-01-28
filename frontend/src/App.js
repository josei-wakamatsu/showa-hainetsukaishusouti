import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [latestItem, setLatestItem] = useState(null); // 最新データ
  const [dailyTotal, setDailyTotal] = useState(0); // 日合計
  const [fiveMinutesTotal, setFiveMinutesTotal] = useState(0); // 5分合計
  const [hourlyTotal, setHourlyTotal] = useState(0); // 1時間合計
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLatestData = () => {
      axios
        .get("http://localhost:3098/api/data/hainetukaishu")
        .then((response) => {
          const latestData = response.data;

          // Flow1 + Flow2 を計算
          const flowRateLpm = latestData.Flow1 + latestData.Flow2;

          // 温度差 (TempC3 - TempC4) を計算
          const deltaT = latestData.tempC3 - latestData.tempC4;

          // 固定値
          const density = 1000; // 流体の密度 (kg/m³)
          const specificHeat = 4186; // 比熱 (J/(kg·K))

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
        })
        .catch((error) => {
          setError("Failed to fetch latest data. " + error.message);
        });
    };

    const fetchTotals = () => {
      // 日合計
      axios.get("http://localhost:3098/api/data/daily-total/hainetukaishu")
        .then((response) => setDailyTotal(response.data.dailyTotal))
        .catch((error) => console.error("Failed to fetch daily total:", error));

      // 5分合計
      axios.get("http://localhost:3098/api/data/five-minutes-total/hainetukaishu")
        .then((response) => setFiveMinutesTotal(response.data.fiveMinutesTotal))
        .catch((error) => console.error("Failed to fetch five minutes total:", error));

      // 1時間合計
      axios.get("http://localhost:3098/api/data/hourly-total/hainetukaishu")
        .then((response) => setHourlyTotal(response.data.hourlyTotal))
        .catch((error) => console.error("Failed to fetch hourly total:", error));
    };

    fetchLatestData(); // 初回データ取得
    fetchTotals(); // 初回累計データ取得
    const interval = setInterval(() => {
      fetchLatestData();
      fetchTotals();
    }, 1000); // 1秒ごとにデータを取得

    return () => clearInterval(interval); // クリーンアップ
  }, []);

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
