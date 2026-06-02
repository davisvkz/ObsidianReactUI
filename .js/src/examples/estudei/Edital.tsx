import {
	ActionIcon,
	Badge,
	Box,
	Checkbox,
	Group,
	Progress,
	Select,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { IconExternalLink, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import {
	editalProgresso,
	topicoPercentual,
} from "@/examples/estudei/aggregate";
import { formatPercentual, percentBadgeColor } from "@/examples/estudei/format";
import type { Topico } from "@/examples/estudei/parse";
import { parseTopicos } from "@/examples/estudei/parse";
import { useMarkdownFile, useSubfolders } from "@/lib/useMarkdownFile";

// ---------------------------------------------------------------------------
// Linha de tópico individual

interface TopicRowProps {
	onAddMaterial: (url: string) => void;
	onToggle: () => void;
	topico: Topico;
}

function TopicRow({ topico, onToggle, onAddMaterial }: TopicRowProps) {
	const [addingLink, setAddingLink] = useState(false);
	const [link, setLink] = useState("");
	const perc = topicoPercentual(topico);
	const color = percentBadgeColor(perc);

	const handleAddLink = () => {
		const trimmed = link.trim();
		if (!trimmed) {
			setAddingLink(false);
			return;
		}
		onAddMaterial(trimmed);
		setLink("");
		setAddingLink(false);
	};

	return (
		<Table.Tr>
			<Table.Td>
				<Checkbox
					checked={topico.concluido}
					label={
						<Text
							size="xs"
							style={{
								color: topico.concluido
									? "var(--mantine-color-dimmed)"
									: undefined,
								paddingLeft: `${(topico.nivel - 1) * 12}px`,
								textDecoration: topico.concluido ? "line-through" : undefined,
							}}
						>
							{topico.id}. {topico.titulo}
						</Text>
					}
					onChange={onToggle}
					radius="sm"
					styles={{
						label: { cursor: "pointer" },
						root: { flex: 1, minWidth: 0 },
					}}
				/>
			</Table.Td>
			<Table.Td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
				<Text c="green" size="xs">
					{topico.acertos}
				</Text>
			</Table.Td>
			<Table.Td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
				<Text c="red" size="xs">
					{topico.erros}
				</Text>
			</Table.Td>
			<Table.Td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
				<Text size="xs">{topico.acertos + topico.erros}</Text>
			</Table.Td>
			<Table.Td style={{ textAlign: "center" }}>
				<Badge color={color} size="xs" variant="filled">
					{perc !== null ? `${Math.round(perc * 100)}%` : "—"}
				</Badge>
			</Table.Td>
			<Table.Td style={{ textAlign: "center" }}>
				{topico.ultimoEstudo ? (
					<Text c="dimmed" size="xs">
						{topico.ultimoEstudo}
					</Text>
				) : (
					<Text c="dimmed" size="xs">
						—
					</Text>
				)}
			</Table.Td>
			<Table.Td>
				<Group gap={4} wrap="nowrap">
					{topico.materiais.map((url) => (
						<Tooltip key={url} label={url} withArrow>
							<ActionIcon
								color="mint"
								component="a"
								href={url}
								rel="noopener noreferrer"
								size="xs"
								target="_blank"
								variant="subtle"
							>
								<IconExternalLink size={12} />
							</ActionIcon>
						</Tooltip>
					))}
					{addingLink ? (
						<TextInput
							autoFocus
							onBlur={() => !link && setAddingLink(false)}
							onChange={(e) => setLink(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleAddLink();
								if (e.key === "Escape") setAddingLink(false);
							}}
							placeholder="https://…"
							size="xs"
							style={{ width: 160 }}
							value={link}
						/>
					) : (
						<ActionIcon
							aria-label="adicionar material"
							color="gray"
							onClick={() => setAddingLink(true)}
							size="xs"
							variant="subtle"
						>
							<IconPlus size={10} />
						</ActionIcon>
					)}
				</Group>
			</Table.Td>
		</Table.Tr>
	);
}

// ---------------------------------------------------------------------------
// Disciplina expandida (Accordion.Panel)

interface DisciplinaEditalProps {
	discPath: string;
}

function DisciplinaEdital({ discPath }: DisciplinaEditalProps) {
	const { frontmatter, update, hostRef } = useMarkdownFile(
		`${discPath}/index.md`,
	);
	const topicos = parseTopicos(frontmatter);
	const progresso = editalProgresso(topicos);

	const toggleTopico = (id: string) => {
		update((fm) => {
			const tpcs = Array.isArray(fm.topicos)
				? (fm.topicos as Record<string, unknown>[])
				: [];
			for (const t of tpcs) {
				if (String(t.id) === id) {
					t.concluido = !(t.concluido === true);
					break;
				}
			}
		});
	};

	const addMaterial = (id: string, url: string) => {
		update((fm) => {
			const tpcs = Array.isArray(fm.topicos)
				? (fm.topicos as Record<string, unknown>[])
				: [];
			for (const t of tpcs) {
				if (String(t.id) === id) {
					if (!Array.isArray(t.materiais)) t.materiais = [];
					(t.materiais as string[]).push(url);
					break;
				}
			}
		});
	};

	const totalConcluidos = topicos.filter((t) => t.concluido).length;
	const percBadgeColor = percentBadgeColor(progresso > 0 ? progresso : null);

	return (
		<Box>
			<span ref={hostRef} style={{ display: "none" }} />
			<Group justify="space-between" mb="xs">
				<Group gap="xs">
					<Text c="dimmed" size="sm">
						{totalConcluidos}/{topicos.length} tópicos concluídos
					</Text>
					<Badge color={percBadgeColor} size="sm" variant="filled">
						{formatPercentual(progresso)}
					</Badge>
				</Group>
			</Group>
			<Progress
				color="mint"
				mb="md"
				radius="sm"
				size="sm"
				value={Math.round(progresso * 100)}
			/>
			{topicos.length === 0 ? (
				<Text c="dimmed" py="md" size="sm" ta="center">
					Nenhum tópico cadastrado ainda.
				</Text>
			) : (
				<Table.ScrollContainer minWidth={500}>
					<Table highlightOnHover striped verticalSpacing="xs">
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Tópico</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>✓</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>✗</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>∑</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>%</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>
									Último Estudo
								</Table.Th>
								<Table.Th>Links</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{topicos.map((t) => (
								<TopicRow
									key={t.id}
									onAddMaterial={(url) => addMaterial(t.id, url)}
									onToggle={() => toggleTopico(t.id)}
									topico={t}
								/>
							))}
						</Table.Tbody>
					</Table>
				</Table.ScrollContainer>
			)}
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Tela Edital Verticalizado

interface EditalProps {
	root: string;
}

export function Edital({ root }: EditalProps) {
	const { items: disciplinas, hostRef } = useSubfolders(root);
	const visibleDiscs = disciplinas.filter((d) => !d.name.startsWith("_"));
	const [selected, setSelected] = useState<string | null>(
		visibleDiscs[0]?.name ?? null,
	);

	const selectData = visibleDiscs.map((d) => ({
		label: d.name,
		value: d.name,
	}));
	const discItem = visibleDiscs.find((d) => d.name === selected);

	return (
		<Stack gap="md">
			<span ref={hostRef} style={{ display: "none" }} />
			<Group justify="space-between" wrap="nowrap">
				<Title order={3}>Edital Verticalizado</Title>
				<Select
					data={selectData}
					onChange={setSelected}
					placeholder="Disciplina..."
					style={{ minWidth: 220 }}
					value={selected}
				/>
			</Group>

			{discItem ? (
				<DisciplinaEdital discPath={discItem.path} />
			) : (
				<Text c="dimmed" py="xl" ta="center">
					Selecione uma disciplina acima.
				</Text>
			)}
		</Stack>
	);
}
