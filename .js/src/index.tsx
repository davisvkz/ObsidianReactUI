import "./index.css";
import {
	ActionIcon,
	Button,
	Checkbox,
	Group,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { useContext, useState } from "react";
import {
	createMarkdown,
	deleteFile,
	updateFrontmatter,
} from "@/scripts/markdownStore";
import { useMarkdownFolder } from "@/scripts/useMarkdownFile";
import { AppContext, mantineRender } from "@/scripts/utils";

function TodoApp({ folder }: { folder: string }) {
	const app = useContext(AppContext);
	if (!app) throw new Error("sem AppContext");
	const { items, hostRef } = useMarkdownFolder(folder);
	const [title, setTitle] = useState("");

	const add = async () => {
		const t = title.trim();
		if (!t) return;
		setTitle("");
		// frontmatter `done: false` já no arquivo criado
		await createMarkdown(app, folder, t, { done: false });
	};

	return (
		<Stack p="md" gap="sm">
			{/* âncora invisível p/ poda de assinantes órfãos */}
			<span ref={hostRef} style={{ display: "none" }} />
			<Title order={3}>To-dos</Title>

			<Group gap="xs">
				<TextInput
					style={{ flex: 1 }}
					placeholder="Novo to-do..."
					value={title}
					onChange={(e) => setTitle(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") add();
					}}
				/>
				<Button onClick={add}>Adicionar</Button>
			</Group>

			{items.length === 0 ? (
				<Text c="dimmed">Nenhum to-do ainda.</Text>
			) : (
				<Stack gap="xs">
					{items.map((item) => {
						const done = item.frontmatter.done === true;
						return (
							<Group key={item.path} justify="space-between" wrap="nowrap">
								<Checkbox
									checked={done}
									label={item.basename}
									// uma escrita = um evento = um render (via debounce)
									onChange={() =>
										updateFrontmatter(app, item.path, (fm) => {
											fm.done = !fm.done;
										})
									}
									styles={{
										label: {
											textDecoration: done ? "line-through" : undefined,
											opacity: done ? 0.6 : 1,
										},
									}}
								/>
								<ActionIcon
									variant="subtle"
									color="red"
									aria-label="excluir"
									onClick={() => deleteFile(app, item.path)}
								>
									<IconTrash size={16} />
								</ActionIcon>
							</Group>
						);
					})}
				</Stack>
			)}
		</Stack>
	);
}

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <TodoApp folder="todos" />);
}
