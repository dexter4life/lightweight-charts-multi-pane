import type { Meta, StoryObj } from "@storybook/html";
import { generateLineData, mountPluginChart } from "../../.storybook/chart-helpers";
import { LineSeries } from "../index";

const meta: Meta = {
  title: "Series/Line",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const { container, chart } = mountPluginChart();
    const series = chart.addSeries(LineSeries, {
      color: "#2196F3",
      lineWidth: 2,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return container;
  },
};

export const Smooth: Story = {
  render: () => {
    const { container, chart } = mountPluginChart();
    const series = chart.addSeries(LineSeries, {
      color: "#4CAF50",
      lineWidth: 3,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return container;
  },
};

export const Stepped: Story = {
  render: () => {
    const { container, chart } = mountPluginChart();
    const series = chart.addSeries(LineSeries, {
      color: "#FF9800",
      lineWidth: 2,
      lineType: 1,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return container;
  },
};

export const Dashed: Story = {
  render: () => {
    const { container, chart } = mountPluginChart();
    const series = chart.addSeries(LineSeries, {
      color: "#9C27B0",
      lineWidth: 2,
      lineType: 2,
    });
    series.setData(generateLineData(500));
    chart.timeScale().fitContent();
    return container;
  },
};