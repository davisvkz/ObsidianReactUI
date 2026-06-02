import "./index.css";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { TodoApp } from "@/examples/todo";
import { mantineRender } from "@/lib/utils";

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <TodoApp root="todos" />);
}
