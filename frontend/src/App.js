import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [latestItem, setLatestItem] = useState(null);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [error, setError] = useState("");

  const backendUrl = "https://showa-hainetsukaishusouti.onrender.com";

  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/data/hainetukaishu`);
        const latestData = response.data;

        if (!latestData || latestData.error || latestData.Flow1 === undefined || latestData.Flow2 === undefined || latestData.tempC3 === undefined || latestData.tempC4 === undefined) {
          throw new Error("データの取得に失敗しました");
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
        console.error("最新データの取得に失敗しました:", error.message);
        setError("最新データの取得に失敗しました: " + error.message);
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
        console.error("累計データの取得に失敗しました:", error);
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

  // 選択した月のデータ取得
  const fetchMonthlyTotal = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/data/monthly-total/hainetukaishu/${selectedYear}/${selectedMonth}`);
      setMonthlyTotal(Number(response.data.monthlyTotal) || 0);
    } catch (error) {
      console.error("月別データの取得に失敗しました:", error);
    }
  };

  return (
    <div>
      <h1>廃熱回収システム</h1>
      {error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <>
          {latestItem && (
            <div>
              <h2>最新のデータ</h2>
              <p>熱量: {latestItem.heatTransfer} kW</p>
            </div>
          )}
          <div>
            <h2>累計データ</h2>
            <p>昨日の合計熱量: {yesterdayTotal} kW</p>
            <p>今日の合計熱量: {todayTotal} kW</p>
          </div>

          <div>
            <h2>月別合計熱量</h2>
            <label>
              年:
              <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} />
            </label>
            <label>
              月:
              <input type="number" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} min="1" max="12" />
            </label>
            <button onClick={fetchMonthlyTotal}>月のデータを取得</button>
            <p>月合計熱量: {monthlyTotal} kW</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
