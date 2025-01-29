import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [latestItem, setLatestItem] = useState(null);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [fiveMinutesTotal, setFiveMinutesTotal] = useState(0);
  const [hourlyTotal, setHourlyTotal] = useState(0);
  const [error, setError] = useState("");

  const backendUrl = "https://showa-hainetsukaishusouti.onrender.com";

  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/data/hainetukaishu`);
        const latestData = response.data;

        if (!latestData.Flow1 || !latestData.Flow2 || !latestData.tempC3 || !latestData.tempC4) {
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

        setError("");
      } catch (error) {
        setError("Failed to fetch latest data: " + error.message);
      }
    };

    const fetchTotals = async () => {
      try {
        const [dailyRes, fiveMinRes, hourlyRes] = await Promise.all([
          axios.get(`${backendUrl}/api/data/daily-total/hainetukaishu`),
          axios.get(`${backendUrl}/api/data/five-minutes-total/hainetukaishu`),
          axios.get(`${backendUrl}/api/data/hourly-total/hainetukaishu`),
        ]);

        setDailyTotal(Number(dailyRes.data.dailyTotal) || 0);
        setFiveMinutesTotal(Number(fiveMinRes.data.fiveMinutesTotal) || 0);
        setHourlyTotal(Number(hourlyRes.data.hourlyTotal) || 0);
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
            <div style={{ marginBottom: "20px", border: "1px solid black", padding: "10px" }}>
              <h2>Latest Data</h2>
              <p><strong>Flow Rate (L/min):</strong> {latestItem.flowRateLpm}</p>
              <p><strong>Temperature Difference (TempC3 - TempC4):</strong> {latestItem.deltaT} °C</p>
              <p><strong>Heat Transfer:</strong> {latestItem.heatTransfer} kW</p>
            </div>
          )}
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
