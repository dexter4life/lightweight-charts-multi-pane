/** @type {import("@storybook/html").Meta} */
const meta = {
  title: "Drawing Tools/All Tools",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Placeholder = {
  render: () => {
    const el = document.createElement("div");
    el.style.padding = "2rem";
    el.style.fontFamily = "sans-serif";
    el.textContent = "Drawing tools stories — coming soon.";
    return el;
  },
};