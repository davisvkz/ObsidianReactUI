import "./index.css";
import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Checkbox,
	Group,
	Paper,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { useState } from "react";
import {
	createTodoFolder,
	deleteFolder,
	type FolderNode,
} from "@/scripts/markdownStore";
import {
	useApp,
	useChildFolders,
	useMarkdownFile,
} from "@/scripts/useMarkdownFile";
import { mantineRender } from "@/scripts/utils";

/** Input de adicionar, revelado sob demanda por um botão "+". */
function AddTodoInline({ parent }: { parent: string }) {
	const app = useApp();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");

	const add = async () => {
		const t = name.trim();
		if (!t) return;
		setName("");
		await createTodoFolder(app, parent, t);
	};

	if (!open) {
		return (
			<ActionIcon
				variant="subtle"
				color="gray"
				size="sm"
				aria-label="adicionar subtarefa"
				onClick={() => setOpen(true)}
			>
				<IconPlus size={14} />
			</ActionIcon>
		);
	}

	return (
		<Group gap={6} wrap="nowrap" w="100%">
			<TextInput
				style={{ flex: 1 }}
				size="xs"
				autoFocus
				placeholder="subtarefa…"
				value={name}
				onChange={(e) => setName(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") add();
					if (e.key === "Escape") setOpen(false);
				}}
				onBlur={() => !name && setOpen(false)}
			/>
			<Button size="xs" variant="light" onClick={add}>
				Add
			</Button>
		</Group>
	);
}

/** Um to-do (pasta com index.md) e seus filhos (subpastas), recursivamente. */
function TodoNode({ node }: { node: FolderNode }) {
	const app = useApp();
	const { frontmatter, update } = useMarkdownFile(`${node.folder}/index.md`);
	const { items: children, hostRef } = useChildFolders(node.folder);
	const done = frontmatter.done === true;

	return (
		<Box>
			<span ref={hostRef} style={{ display: "none" }} />
			<Group gap="xs" wrap="nowrap" justify="space-between" py={2}>
				<Checkbox
					radius="sm"
					checked={done}
					label={node.name}
					onChange={() =>
						update((fm) => {
							fm.done = !fm.done;
						})
					}
					styles={{
						root: { flex: 1, minWidth: 0 },
						label: {
							cursor: "pointer",
							textDecoration: done ? "line-through" : undefined,
							color: done ? "var(--mantine-color-dimmed)" : undefined,
						},
					}}
				/>
				<Group gap={2} wrap="nowrap">
					<AddTodoInline parent={node.folder} />
					<ActionIcon
						variant="subtle"
						color="red"
						size="sm"
						aria-label="excluir"
						onClick={() => deleteFolder(app, node.folder)}
					>
						<IconTrash size={14} />
					</ActionIcon>
				</Group>
			</Group>

			{children.length > 0 && (
				<Stack
					gap={0}
					ml="sm"
					pl="sm"
					style={{ borderLeft: "2px solid var(--mantine-color-dark-4)" }}
				>
					{children.map((c) => (
						<TodoNode key={c.folder} node={c} />
					))}
				</Stack>
			)}
		</Box>
	);
}

function TodoApp({ root }: { root: string }) {
	const app = useApp();
	const { items, hostRef } = useChildFolders(root);
	const total = items.length;
	const [title, setTitle] = useState("");

	const add = async () => {
		const t = title.trim();
		if (!t) return;
		setTitle("");
		await createTodoFolder(app, root, t);
	};

	return (
		<Paper p="md" radius="md" withBorder maw={560}>
			<span ref={hostRef} style={{ display: "none" }} />
			<Group justify="space-between" mb="sm">
				<Title order={4}>To-dos</Title>
				{total > 0 && (
					<Badge variant="light" color="gray" radius="sm">
						{total}
					</Badge>
				)}
			</Group>

			<Group gap="xs" mb="md" wrap="nowrap">
				<TextInput
					style={{ flex: 1 }}
					placeholder="Novo to-do…"
					value={title}
					onChange={(e) => setTitle(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") add();
					}}
				/>
				<Button onClick={add} leftSection={<IconPlus size={16} />}>
					Adicionar
				</Button>
			</Group>

			{items.length === 0 ? (
				<Text c="dimmed" size="sm" ta="center" py="lg">
					Nenhum to-do ainda. Adicione o primeiro acima.
				</Text>
			) : (
				<Stack gap={0}>
					{items.map((c) => (
						<TodoNode key={c.folder} node={c} />
					))}
				</Stack>
			)}
		</Paper>
	);
}

export default async function (dv: DataviewInlineApi) {
	return mantineRender(dv, <TodoApp root="todos" />);
}
