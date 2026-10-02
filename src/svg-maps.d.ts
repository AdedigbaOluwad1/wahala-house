declare module '@svg-maps/nigeria' {
  const map: { label: string; viewBox: string; locations: { id: string; name: string; path: string }[] };
  export default map;
}

interface ImportMetaEnv {
  readonly VITE_E2E?: string;
}
