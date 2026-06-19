import { ActionIcon, Checkbox, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { Link, useNavigate, useParams } from "react-router";
import { TODO_ROOT, AddTodoInline, TodoNode } from "@/examples/todo";
import { trashPath, useApp, useMarkdownFile, useSubfolders } from "@/lib";

export default function TodoDetail() {
	const { id } = useParams<{ id: string }>();
	const app = useApp();
	const name = decodeURIComponent(id ?? "");
	const path = `${TODO_ROOT}/${name}`;
	const { frontmatter, exists, update } = useMarkdownFile(`${path}/index.md`);
	const { items: children } = useSubfolders(path);
	const navigate = useNavigate();

	if (!exists) {
		return (
			<>
				<ActionIcon aria-label="back" component={Link} mb="sm" size="sm" to="/" variant="subtle">
					<IconArrowLeft size={14} />
				</ActionIcon>
				<Text c="dimmed" size="sm">To-do not found.</Text>
			</>
		);
	}

	const done = frontmatter.done === true;

	const deleteTodo = async () => {
		await trashPath(app, path);
		navigate("/");
	};

	return (
		<>
			<Group justify="space-between" mb="sm" wrap="nowrap">
				<Group gap="xs" style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
					<ActionIcon aria-label="back" component={Link} size="sm" to="/" variant="subtle">
						<IconArrowLeft size={14} />
					</ActionIcon>
					<Checkbox
						checked={done}
						label={<Title order={4}>{name}</Title>}
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
				</Group>
				<ActionIcon aria-label="delete" color="red" onClick={deleteTodo} size="sm" variant="subtle">
					<IconTrash size={14} />
				</ActionIcon>
			</Group>

			{children.length === 0 ? (
				<Text c="dimmed" py="sm" size="sm" ta="center">
					No subtasks yet.
				</Text>
			) : (
				<Stack gap={0} mb="xs">
					{children.map((c) => (
						<TodoNode key={c.path} node={c} />
					))}
				</Stack>
			)}

			<AddTodoInline parent={path} />
		</>
	);
}
