import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [latestItem, setLatestItem] = useState(null);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [error, setError] = useState("");

  const backendUrl = "https://showa-hainetsukaishusouti.onrender.com";

  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/data/hainetukaishu`);
        const latestData = response.data;

        if (!latestData || latestData.error || latestData.Flow1 === undefined || latestData.Flow2 === undefined || latestData.tempC3 === undefined || latestData.tempC4 === undefined) {
          throw new Error("Invalid data received");
        }

        const flowRateLpm = latestData.Flow1 + latestData.Flow2;
        const deltaT = latestData.tempC3 - latestData.tempC4;
        const density = 1000;
        const specificHeat = 4186;
        const flowRateM3s = flowRateLpm / (1000 * 60);
        const massFlowRate = flowRateM3s * density;
        const heatTransfer = massFlowRate * specificHeat * deltaT / 1000;

        setLatestItem({
          ...latestData,
          flowRateLpm: flowRateLpm.toFixed(2),
          deltaT: deltaT.toFixed(2),
          heatTransfer: heatTransfer.toFixed(2),
        });

        setError(""); // エラーをリセット
      } catch (error) {
        console.error("Failed to fetch latest data:", error.message);
        setError("Failed to fetch latest data: " + error.message);
      }
    };

    const fetchTotals = async () => {
      try {
        const [yesterdayRes, todayRes] = await Promise.all([
          axios.get(`${backendUrl}/api/data/yesterday-total/hainetukaishu`),
          axios.get(`${backendUrl}/api/data/today-total/hainetukaishu`),
        ]);

        setYesterdayTotal(Number(yesterdayRes.data.yesterdayTotal) || 0);
        setTodayTotal(Number(todayRes.data.todayTotal) || 0);
      } catch (error) {
        console.error("Failed to fetch totals:", error);
      }
    };

    fetchLatestData();
    fetchTotals();

    const interval = setInterval(() => {
      fetchLatestData();
      fetchTotals();
    }, 5000);

    return () => clearInterval(interval);
  }, [backendUrl]);

  return (
    <div>
      <h1>Real-Time Heat Energy Viewer</h1>
      {error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <>
          {latestItem && (
            <div>
              <h2>Latest Data</h2>
              <p>Heat Transfer: {latestItem.heatTransfer} kW</p>
            </div>
          )}
          <div>
            <h2>Cumulative Data</h2>
            <p>Yesterday Total: {yesterdayTotal} kW</p>
            <p>Today Total: {todayTotal} kW</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
