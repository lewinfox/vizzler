// Bun supports text imports via `with { type: "text" }`. These declarations
// teach TypeScript that imported .frag/.vert/.glsl files resolve to strings.

declare module "*.frag" {
  const text: string;
  export default text;
}
declare module "*.vert" {
  const text: string;
  export default text;
}
declare module "*.glsl" {
  const text: string;
  export default text;
}
