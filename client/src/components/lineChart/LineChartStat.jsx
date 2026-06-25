import React from "react";
import ReactECharts from "echarts-for-react";
import { useTheme } from "../../context/themeContext";

const ChartComponent = ({ data = [] }) => {
  const { theme } = useTheme();
  const xData = data.map((item) => item.label);
  const yData = data.map((item) => Number(item.value) || 0);
  const maxValue = yData.length > 0 ? Math.max(...yData) : 0;
  const yAxisMax = maxValue <= 0 ? 1 : Math.ceil(maxValue * 1.1);
  const xAxisLabelInterval = xData.length > 16 ? 1 : 0;
  const cssVars = getComputedStyle(document.documentElement);
  const labelColor = theme === "light"
    ? (cssVars.getPropertyValue("--noirbe").trim() || "#1f1f1f")
    : (cssVars.getPropertyValue("--whiteBeMax").trim() || "#f5f5f5");

  const options = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        data: xData,
        axisLabel: {
          color: labelColor,
          interval: xAxisLabelInterval
        },
        axisTick: {
          alignWithLabel: true
        }
      }
    ],
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: yAxisMax,
        axisLabel: {
          color: labelColor
        }
      }
    ],
    series: [
      {
        name: 'Vente',
        type: 'bar',
        barWidth: xData.length > 16 ? '45%' : '60%',
        data: yData,
        label: {
          show: true,
          position: "top",
          formatter: "{c}",
          color: labelColor
        }
      }
    ]
  };

  return <ReactECharts option={options} style={{ height: "100%", width: "100%" }}/>;
};

export default ChartComponent;
