import "./index.css";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { EstudeiApp } from "@/examples/estudei/EstudeiApp";
import { estudeiTheme } from "@/examples/estudei/theme";
import { mantineRender } from "@/lib/utils";

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <EstudeiApp root="estudei" />, {
		theme: estudeiTheme,
		defaultColorScheme: "light",
	});
}
