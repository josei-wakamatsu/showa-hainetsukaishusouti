import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Chart.js の初期化
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const TemperatureChart = ({ data }) => {
  // データをグラフ用に変換
  const labels = data.map((item) => item.time); // 横軸 (時間)
  const tempC1 = data.map((item) => item.tempC1); // tempC1 の値
  const tempC2 = data.map((item) => item.tempC2); // tempC2 の値
  const tempC3 = data.map((item) => item.tempC3); // tempC3 の値
  const tempC4 = data.map((item) => item.tempC4); // tempC4 の値

  // グラフの設定
  const chartData = {
    labels,
    datasets: [
      {
        label: "TempC1",
        data: tempC1,
        borderColor: "rgba(255, 99, 132, 1)", // 赤色
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        fill: false,
      },
      {
        label: "TempC2",
        data: tempC2,
        borderColor: "rgba(54, 162, 235, 1)", // 青色
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        fill: false,
      },
      {
        label: "TempC3",
        data: tempC3,
        borderColor: "rgba(75, 192, 192, 1)", // 緑色
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: false,
      },
      {
        label: "TempC4",
        data: tempC4,
        borderColor: "rgba(153, 102, 255, 1)", // 紫色
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Temperature Over Time",
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        title: {
          display: true,
          text: "Temperature",
        },
      },
    },
  };

  return <Line data={chartData} options={options} />;
};

export default TemperatureChart;
