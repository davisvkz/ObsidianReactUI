import "./index.css";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { mantineRender } from "@/scripts/utils";

function Component() {
	return (
		<></>
	);
}

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <Component />);
}
