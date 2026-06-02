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
import type { App } from "obsidian";
import { useState } from "react";
import { sanitizeFolderName } from "@/examples/todoNaming";
import {
	ensureFolder,
	type Subfolder,
	trashPath,
} from "@/scripts/markdownStore";
import {
	useApp,
	useMarkdownFile,
	useSubfolders,
} from "@/scripts/useMarkdownFile";

/**
 * Convenção do EXEMPLO to-do (não do core): um to-do é uma pasta com `index.md`
 * guardando `done`; filhos são subpastas. Cria a pasta evitando colisão de nome.
 */
async function createTodoFolder(
	app: App,
	parent: string,
	name: string,
): Promise<string> {
	await ensureFolder(app, parent);
	const safe = sanitizeFolderName(name);
	let folder = `${parent}/${safe}`;
	let n = 1;
	while (app.vault.getAbstractFileByPath(folder)) {
		folder = `${parent}/${safe} ${++n}`;
	}
	await app.vault.createFolder(folder);
	await app.vault.create(`${folder}/index.md`, "---\ndone: false\n---\n");
	return folder;
}

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
				aria-label="adicionar subtarefa"
				color="gray"
				onClick={() => setOpen(true)}
				size="sm"
				variant="subtle"
			>
				<IconPlus size={14} />
			</ActionIcon>
		);
	}

	return (
		<Group gap={6} w="100%" wrap="nowrap">
			<TextInput
				autoFocus
				onBlur={() => !name && setOpen(false)}
				onChange={(e) => setName(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") add();
					if (e.key === "Escape") setOpen(false);
				}}
				placeholder="subtarefa…"
				size="xs"
				style={{ flex: 1 }}
				value={name}
			/>
			<Button onClick={add} size="xs" variant="light">
				Add
			</Button>
		</Group>
	);
}

/** Um to-do (pasta com index.md) e seus filhos (subpastas), recursivamente. */
function TodoNode({ node }: { node: Subfolder }) {
	const app = useApp();
	const { frontmatter, exists, update } = useMarkdownFile(
		`${node.path}/index.md`,
	);
	const { items: children, hostRef } = useSubfolders(node.path);

	// É o EXEMPLO (não o core) que define "to-do = pasta + index.md": uma subpasta
	// sem index.md (ou cuja nota foi deletada) simplesmente não renderiza — some o
	// nó e toda a sua subárvore, sem virar fantasma.
	if (!exists) return null;

	const done = frontmatter.done === true;

	return (
		<Box>
			<span ref={hostRef} style={{ display: "none" }} />
			<Group gap="xs" justify="space-between" py={2} wrap="nowrap">
				<Checkbox
					checked={done}
					label={node.name}
					onChange={() =>
						update((fm) => {
							fm.done = !fm.done;
						})
					}
					radius="sm"
					styles={{
						label: {
							color: done ? "var(--mantine-color-dimmed)" : undefined,
							cursor: "pointer",
							textDecoration: done ? "line-through" : undefined,
						},
						root: { flex: 1, minWidth: 0 },
					}}
				/>
				<Group gap={2} wrap="nowrap">
					<AddTodoInline parent={node.path} />
					<ActionIcon
						aria-label="excluir"
						color="red"
						onClick={() => trashPath(app, node.path)}
						size="sm"
						variant="subtle"
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
						<TodoNode key={c.path} node={c} />
					))}
				</Stack>
			)}
		</Box>
	);
}

/** App de exemplo: árvore de to-dos sob `root` (uma pasta-container, sem index.md). */
export function TodoApp({ root }: { root: string }) {
	const app = useApp();
	const { items, hostRef } = useSubfolders(root);
	const total = items.length;
	const [title, setTitle] = useState("");

	const add = async () => {
		const t = title.trim();
		if (!t) return;
		setTitle("");
		await createTodoFolder(app, root, t);
	};

	return (
		<Paper maw={560} p="md" radius="md" withBorder>
			<span ref={hostRef} style={{ display: "none" }} />
			<Group justify="space-between" mb="sm">
				<Title order={4}>To-dos</Title>
				{total > 0 && (
					<Badge color="gray" radius="sm" variant="light">
						{total}
					</Badge>
				)}
			</Group>

			<Group gap="xs" mb="md" wrap="nowrap">
				<TextInput
					onChange={(e) => setTitle(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") add();
					}}
					placeholder="Novo to-do…"
					style={{ flex: 1 }}
					value={title}
				/>
				<Button leftSection={<IconPlus size={16} />} onClick={add}>
					Adicionar
				</Button>
			</Group>

			{items.length === 0 ? (
				<Text c="dimmed" py="lg" size="sm" ta="center">
					Nenhum to-do ainda. Adicione o primeiro acima.
				</Text>
			) : (
				<Stack gap={0}>
					{items.map((c) => (
						<TodoNode key={c.path} node={c} />
					))}
				</Stack>
			)}
		</Paper>
	);
}
