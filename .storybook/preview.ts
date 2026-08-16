/// <reference types="vite/client" />
// HMR: Storybook's html framework only cancels play functions on vite:afterUpdate,
// it does not re-render stories. Emit FORCE_RE_RENDER so stories re-mount with new code.
if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => {
    ((window as any) as any).__STORYBOOK_PREVIEW__?.channel.emit("forceReRender");
  });
}

const preview = {
  parameters: {
    layout: "fullscreen",
    options: {
      storySort: (a, b) =>
        a.title.localeCompare(b.title, undefined, { numeric: true }),
    },
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