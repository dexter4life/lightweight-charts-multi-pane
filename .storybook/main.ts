export default {
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
    enableCrashReports: false,
  },
  features: {
    sidebarOnboardingChecklist: false,
  },
  stories: ["../src/stories/**/*.story.@(ts|mdx)"],
  addons: [],
  framework: {
    name: "@storybook/html-vite",
    options: {},
  }
};