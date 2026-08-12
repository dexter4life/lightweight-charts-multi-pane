import type { Meta, StoryObj } from "@storybook/html";
// import { createChart } from "lightweight-charts";
import { mountChart } from "../../.storybook/chart-helpers";
import { generateLineData } from "../../.storybook/sample-data";

const meta: Meta = {
  title: "Series/Line",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const chart = mountChart(createChart);
    const series = chart.addLineSeries({
      color: "#2196F3",
      lineWidth: 2,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return "";
  },
};

export const Smooth: Story = {
  render: () => {
    const chart = mountChart(createChart);
    const series = chart.addLineSeries({
      color: "#4CAF50",
      lineWidth: 3,
      lineType: 0,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return "";
  },
};

export const Stepped: Story = {
  render: () => {
    const chart = mountChart(createChart);
    const series = chart.addLineSeries({
      color: "#FF9800",
      lineWidth: 2,
      lineType: 1,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return "";
  },
};

export const Dashed: Story = {
  render: () => {
    const chart = mountChart(createChart);
    const series = chart.addLineSeries({
      color: "#9C27B0",
      lineWidth: 2,
      lineType: 2,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return "";
  },
};