// Vite text-import declarations. Importing a shader file with the `?raw`
// query suffix makes Vite (and bundlers in general) emit the file's text
// content as the default export. TypeScript needs to be told this.

declare module "*.frag?raw" {
  const text: string;
  export default text;
}
declare module "*.vert?raw" {
  const text: string;
  export default text;
}
declare module "*.glsl?raw" {
  const text: string;
  export default text;
}
