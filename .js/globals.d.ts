declare const __STYLE__: string;

interface Window {
	/** Store singleton de markdown, persistente entre re-evals do bundle. */
	__mdStore__?: unknown;
	/** Root React do render anterior, para desmontagem antes de remontar. */
	__mdRoot__?: import("react-dom/client").Root;
}
declare module '*.css';
declare module '*.css?raw' {
  const content: string;
  export default content;
}
