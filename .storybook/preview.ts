const preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0e0e0e" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

export const parameters = {
  options: {
    storySort: (a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true }),
  },
};