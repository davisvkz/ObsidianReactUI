import { ActionIcon, Box, Checkbox, Group, Stack, TextInput, Button } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { App } from "obsidian";
import { useState } from "react";
import { sanitizeFolderName } from "@/examples/todoNaming";
import {
	ensureFolder,
	type Subfolder,
	trashPath,
	useApp,
	useMarkdownFile,
	useSubfolders,
} from "@/lib";

/**
 * Convention for the to-do EXAMPLE (not the core): a to-do is a folder with `index.md`
 * storing `done`; children are subfolders. Creates the folder avoiding name collisions.
 */
export async function createTodoFolder(app: App, parent: string, name: string): Promise<string> {
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

/** Inline add input, revealed on demand via a "+" button. */
export function AddTodoInline({ parent }: { parent: string }) {
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
				aria-label="add subtask"
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
					if (e.key === "Enter") void add();
					if (e.key === "Escape") setOpen(false);
				}}
				placeholder="subtask…"
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

/** A to-do (folder with index.md) and its children (subfolders), recursively. */
export function TodoNode({ node }: { node: Subfolder }) {
	const app = useApp();
	const { frontmatter, exists, update } = useMarkdownFile(`${node.path}/index.md`);
	const { items: children } = useSubfolders(node.path);

	// It is the EXAMPLE (not the core) that defines "to-do = folder + index.md": a subfolder
	// without index.md (or whose note was deleted) simply does not render — the node
	// and its entire subtree disappear, never becoming a ghost.
	if (!exists) return null;

	const done = frontmatter.done === true;

	return (
		<Box>
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
						aria-label="delete"
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

export const TODO_ROOT = "todos";
