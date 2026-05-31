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
import { useState } from "react";
import { createTodoFolder, deleteFolder } from "@/scripts/markdownStore";
import {
	useApp,
	useChildFolders,
	useMarkdownFile,
} from "@/scripts/useMarkdownFile";
import { mantineRender } from "@/scripts/utils";

/** Input compacto que cria um (sub-)to-do ao confirmar. */
function AddTodo({
	parent,
	placeholder,
	size,
}: {
	parent: string;
	placeholder: string;
	size?: "xs" | "sm";
}) {
	const app = useApp();
	const [name, setName] = useState("");

	const add = async () => {
		const t = name.trim();
		if (!t) return;
		setName("");
		await createTodoFolder(app, parent, t);
	};

	return (
		<Group gap="xs" wrap="nowrap">
			<TextInput
				style={{ flex: 1 }}
				size={size}
				placeholder={placeholder}
				value={name}
				onChange={(e) => setName(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") add();
				}}
			/>
			<Button size={size} variant="light" onClick={add}>
				+
			</Button>
		</Group>
	);
}

/** Um to-do (pasta com index.md) + seus filhos (subpastas), recursivamente. */
function TodoNode({ folder, name }: { folder: string; name: string }) {
	const app = useApp();
	const { frontmatter, update } = useMarkdownFile(`${folder}/index.md`);
	const { items: children, hostRef } = useChildFolders(folder);
	const done = frontmatter.done === true;

	return (
		<Stack gap={4}>
			<span ref={hostRef} style={{ display: "none" }} />
			<Group gap="xs" wrap="nowrap" justify="space-between">
				<Checkbox
					checked={done}
					label={name}
					onChange={() =>
						update((fm) => {
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
					onClick={() => deleteFolder(app, folder)}
				>
					<IconTrash size={16} />
				</ActionIcon>
			</Group>

			<Stack
				gap={4}
				pl="lg"
				style={{ borderLeft: "1px solid var(--mantine-color-dark-4)" }}
			>
				{children.map((c) => (
					<TodoNode key={c.folder} folder={c.folder} name={c.name} />
				))}
				<AddTodo parent={folder} placeholder="sub-to-do..." size="xs" />
			</Stack>
		</Stack>
	);
}

function TodoApp({ root }: { root: string }) {
	const { items, hostRef } = useChildFolders(root);

	return (
		<Stack p="md" gap="sm">
			<span ref={hostRef} style={{ display: "none" }} />
			<Title order={3}>To-dos</Title>

			<AddTodo parent={root} placeholder="Novo to-do..." size="sm" />

			{items.length === 0 ? (
				<Text c="dimmed">Nenhum to-do ainda.</Text>
			) : (
				<Stack gap="xs">
					{items.map((c) => (
						<TodoNode key={c.folder} folder={c.folder} name={c.name} />
					))}
				</Stack>
			)}
		</Stack>
	);
}

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <TodoApp root="todos" />);
}
