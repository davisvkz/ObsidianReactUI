import "./index.css";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { createFsRoutes, mantineRender, PersistentRouter } from "@/lib";

const routes = createFsRoutes(require.context("./routes", true, /\.(tsx|ts)$/));

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <PersistentRouter routes={routes} />);
}
