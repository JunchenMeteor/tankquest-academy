export const clientConfig = {
  apiBaseUrl:
    import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? 'http://127.0.0.1:3000' : ''),
  demoChildId: import.meta.env.VITE_DEMO_CHILD_ID ?? 'child_demo',
};
