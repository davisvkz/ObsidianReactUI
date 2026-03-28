declare const __STYLE__: string;
declare module '*.css';
declare module '*.css?raw' {
  const content: string;
  export default content;
}
