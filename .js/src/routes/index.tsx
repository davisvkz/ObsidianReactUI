import { ActionIcon, Badge, Button, Checkbox, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconArrowRight, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { TODO_ROOT, createTodoFolder } from "@/examples/todo";
import { type Subfolder, trashPath, useApp, useMarkdownFile, useSubfolders } from "@/lib";

function TodoListItem({ node }: { node: Subfolder }) {
	const app = useApp();
	const { frontmatter, exists, update } = useMarkdownFile(`${node.path}/index.md`);
	const { items: children } = useSubfolders(node.path);

	if (!exists) return null;
	const done = frontmatter.done === true;

	return (
		<Group gap="xs" justify="space-between" py={2} wrap="nowrap">
			<Checkbox
				checked={done}
				label={node.name}
				onChange={() => update((fm) => { fm.done = !fm.done; })}
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
			<Group gap={4} wrap="nowrap">
				{children.length > 0 && (
					<Badge color="gray" radius="sm" size="xs" variant="light">
						{children.length}
					</Badge>
				)}
				<ActionIcon
					aria-label="view subtasks"
					color="gray"
					component={Link}
					size="sm"
					to={`/${encodeURIComponent(node.name)}`}
					variant="subtle"
				>
					<IconArrowRight size={14} />
				</ActionIcon>
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
	);
}

export default function HomePage() {
	const app = useApp();
	const { items } = useSubfolders(TODO_ROOT);
	const [title, setTitle] = useState("");

	const add = async () => {
		const t = title.trim();
		if (!t) return;
		setTitle("");
		await createTodoFolder(app, TODO_ROOT, t);
	};

	return (
		<>
			<Group justify="space-between" mb="sm">
				<Title order={4}>To-dos</Title>
				{items.length > 0 && (
					<Badge color="gray" radius="sm" variant="light">
						{items.length}
					</Badge>
				)}
			</Group>

			<Group gap="xs" mb="md" wrap="nowrap">
				<TextInput
					onChange={(e) => setTitle(e.currentTarget.value)}
					onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
					placeholder="New to-do…"
					style={{ flex: 1 }}
					value={title}
				/>
				<Button leftSection={<IconPlus size={16} />} onClick={add}>
					Add
				</Button>
			</Group>

			{items.length === 0 ? (
				<Text c="dimmed" py="lg" size="sm" ta="center">
					No to-dos yet. Add the first one above.
				</Text>
			) : (
				<Stack gap={0}>
					{items.map((c) => (
						<TodoListItem key={c.path} node={c} />
					))}
				</Stack>
			)}
		</>
	);
}
