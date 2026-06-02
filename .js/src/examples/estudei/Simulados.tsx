import { LineChart } from "@mantine/charts";
import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Collapse,
	Group,
	Modal,
	NumberInput,
	Progress,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from "@tabler/icons-react";
import type { App } from "obsidian";
import { useMemo, useState } from "react";
import { aggregateSimulados } from "@/examples/estudei/aggregate";
import { formatDuracao, isoDay, percentBadgeColor } from "@/examples/estudei/format";
import type { FormatoSimulado, SimuladoDisciplina } from "@/examples/estudei/parse";
import { parseSimulado } from "@/examples/estudei/parse";
import type { SimuladoAgg } from "@/examples/estudei/aggregate";
import { StatCard } from "@/examples/estudei/StatCard";
import {
	useApp,
	useFolderFiles,
	useMarkdownFile,
	useSubfolders,
} from "@/lib/useMarkdownFile";
import { ensureFolder } from "@/lib/store";

// ---------------------------------------------------------------------------
// Modal de novo simulado

interface DiscRow {
	acertos: number;
	brancos: number;
	erros: number;
	nome: string;
	peso: number;
	total: number;
}

interface NovoSimuladoModalProps {
	app: App;
	discNames: string[];
	onClose: () => void;
	opened: boolean;
	root: string;
}

function NovoSimuladoModal({ opened, onClose, app, root, discNames }: NovoSimuladoModalProps) {
	const today = isoDay(new Date());
	const [nome, setNome] = useState("");
	const [data, setData] = useState(today);
	const [formato, setFormato] = useState<FormatoSimulado>("MULTIPLA_ESCOLHA");
	const [banca, setBanca] = useState("");
	const [duracaoMin, setDuracaoMin] = useState<number | string>(120);
	const [discs, setDiscs] = useState<DiscRow[]>([
		{ nome: discNames[0] ?? "", peso: 1, total: 0, acertos: 0, erros: 0, brancos: 0 },
	]);

	const addDisc = () =>
		setDiscs((prev) => [
			...prev,
			{ nome: discNames[0] ?? "", peso: 1, total: 0, acertos: 0, erros: 0, brancos: 0 },
		]);
	const removeDisc = (idx: number) => setDiscs((prev) => prev.filter((_, i) => i !== idx));
	const updateDisc = (idx: number, field: keyof DiscRow, value: unknown) =>
		setDiscs((prev) =>
			prev.map((row, i) =>
				i === idx ? { ...row, [field]: typeof row[field] === "number" ? Number(value) : value } : row,
			),
		);

	const handleSave = async () => {
		const folder = `${root}/_simulados`;
		await ensureFolder(app, folder);

		const slug = nome
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "");
		const filename = `${data}-${slug || "simulado"}.md`;

		const disciplinasYaml = discs
			.map(
				(d) =>
					`  - nome: "${d.nome}"\n    peso: ${d.peso}\n    total: ${d.total}\n    acertos: ${d.acertos}\n    erros: ${d.erros}\n    brancos: ${d.brancos}`,
			)
			.join("\n");

		const front = [
			"---",
			"tipo: simulado",
			`nome: "${nome || "Simulado"}"`,
			`data: '${data}'`,
			`formato: ${formato}`,
			banca ? `banca: "${banca}"` : "",
			`duracaoMin: ${Number(duracaoMin) || 0}`,
			"disciplinas:",
			disciplinasYaml,
			"---",
		]
			.filter((l) => l !== "")
			.join("\n");

		await app.vault.create(`${folder}/${filename}`, `${front}\n`);
		onClose();
	};

	return (
		<Modal
			centered
			onClose={onClose}
			opened={opened}
			size="lg"
			title={<Text fw={700}>Novo Simulado</Text>}
		>
			<Stack gap="sm">
				<Group grow>
					<TextInput
						label="Nome"
						onChange={(e) => setNome(e.currentTarget.value)}
						placeholder="Simulado 01"
						value={nome}
					/>
					<TextInput
						label="Data"
						onChange={(e) => setData(e.currentTarget.value)}
						placeholder="YYYY-MM-DD"
						value={data}
					/>
				</Group>
				<Group grow>
					<Select
						data={[
							{ label: "Múltipla Escolha", value: "MULTIPLA_ESCOLHA" },
							{ label: "Certo/Errado", value: "CERTO_ERRADO" },
						]}
						label="Formato"
						onChange={(v) => setFormato((v as FormatoSimulado) ?? "MULTIPLA_ESCOLHA")}
						value={formato}
					/>
					<TextInput
						label="Banca (opcional)"
						onChange={(e) => setBanca(e.currentTarget.value)}
						placeholder="FCC, CESPE…"
						value={banca}
					/>
					<NumberInput
						label="Duração (min)"
						min={0}
						onChange={setDuracaoMin}
						value={Number(duracaoMin)}
					/>
				</Group>

				<Text fw={600} mt="xs" size="sm">
					Resultados por disciplina
				</Text>
				{discs.map((d, idx) => (
					<Group gap="xs" key={idx} wrap="nowrap">
						<TextInput
							list={`disc-list-${idx}`}
							onChange={(e) => updateDisc(idx, "nome", e.currentTarget.value)}
							placeholder="Disciplina"
							style={{ flex: 2 }}
							value={d.nome}
						/>
						<datalist id={`disc-list-${idx}`}>
							{discNames.map((n) => (
								<option key={n} value={n} />
							))}
						</datalist>
						<NumberInput
							label="Peso"
							min={1}
							onChange={(v) => updateDisc(idx, "peso", v)}
							style={{ flex: 1 }}
							value={d.peso}
						/>
						<NumberInput
							label="Total"
							min={0}
							onChange={(v) => updateDisc(idx, "total", v)}
							style={{ flex: 1 }}
							value={d.total}
						/>
						<NumberInput
							label="Acertos"
							min={0}
							onChange={(v) => updateDisc(idx, "acertos", v)}
							style={{ flex: 1 }}
							value={d.acertos}
						/>
						<NumberInput
							label="Erros"
							min={0}
							onChange={(v) => updateDisc(idx, "erros", v)}
							style={{ flex: 1 }}
							value={d.erros}
						/>
						<ActionIcon
							color="red"
							mt={24}
							onClick={() => removeDisc(idx)}
							variant="subtle"
						>
							<IconTrash size={14} />
						</ActionIcon>
					</Group>
				))}
				<Button
					leftSection={<IconPlus size={14} />}
					onClick={addDisc}
					size="xs"
					variant="subtle"
				>
					Adicionar disciplina
				</Button>

				<Group justify="flex-end" mt="sm">
					<Button onClick={onClose} variant="subtle">
						Cancelar
					</Button>
					<Button color="mint" onClick={handleSave}>
						Salvar
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

// ---------------------------------------------------------------------------
// Card de simulado individual

interface SimuladoCardProps {
	agg: SimuladoAgg;
	index: number;
}

function SimuladoCard({ agg, index }: SimuladoCardProps) {
	const [expanded, setExpanded] = useState(false);
	const percColor = percentBadgeColor(agg.desempenho);
	const percDisplay = `${Math.round(agg.desempenho * 100)}%`;

	return (
		<Card padding="sm" radius="md" withBorder>
			<Group
				justify="space-between"
				onClick={() => setExpanded((p) => !p)}
				style={{ cursor: "pointer" }}
				wrap="nowrap"
			>
				<Group gap="xs">
					<Text c="dimmed" size="sm">
						{agg.data}
					</Text>
					<Text fw={600} size="sm">
						{agg.nome}
					</Text>
					{agg.banca && (
						<Text c="dimmed" size="xs">
							{agg.formato === "MULTIPLA_ESCOLHA" ? "Múltipla Escolha" : "Certo/Errado"} •{" "}
							{agg.banca}
						</Text>
					)}
				</Group>
				<Group gap="xs">
					<Text c="dimmed" size="xs">
						{formatDuracao(agg.duracaoMin)}
					</Text>
					<Text c="green" size="sm">
						{agg.acertos}
					</Text>
					<Text c="dimmed" size="xs">
						·
					</Text>
					<Text c="red" size="sm">
						{agg.erros}
					</Text>
					<Badge color={percColor} size="sm" variant="filled">
						{percDisplay}
					</Badge>
					{expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
				</Group>
			</Group>

			<Collapse in={expanded}>
				<Table.ScrollContainer minWidth={400}>
					<Table mt="sm" striped verticalSpacing="xs">
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Disciplina</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>Peso</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>Total</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>✓</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>✗</Table.Th>
								<Table.Th style={{ textAlign: "center" }}>%</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{agg.disciplinas.map((d: SimuladoDisciplina) => {
								const q = d.acertos + d.erros;
								const p = q > 0 ? d.acertos / q : null;
								return (
									<Table.Tr key={d.nome}>
										<Table.Td>
											<Text size="sm">{d.nome}</Text>
										</Table.Td>
										<Table.Td style={{ textAlign: "center" }}>
											<Text size="sm">{d.peso}</Text>
										</Table.Td>
										<Table.Td style={{ textAlign: "center" }}>
											<Text size="sm">{d.total}</Text>
										</Table.Td>
										<Table.Td style={{ textAlign: "center" }}>
											<Text c="green" size="sm">
												{d.acertos}
											</Text>
										</Table.Td>
										<Table.Td style={{ textAlign: "center" }}>
											<Text c="red" size="sm">
												{d.erros}
											</Text>
										</Table.Td>
										<Table.Td style={{ textAlign: "center" }}>
											<Badge color={percentBadgeColor(p)} size="xs" variant="filled">
												{p !== null ? `${Math.round(p * 100)}%` : "—"}
											</Badge>
										</Table.Td>
									</Table.Tr>
								);
							})}
						</Table.Tbody>
					</Table>
				</Table.ScrollContainer>
			</Collapse>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Tela principal

interface SimuladosProps {
	root: string;
}

export function Simulados({ root }: SimuladosProps) {
	const app = useApp();
	const [novoOpen, setNovoOpen] = useState(false);

	const { items: discFolders, hostRef: discHostRef } = useSubfolders(root);
	const { items: simFiles, hostRef: simHostRef } = useFolderFiles(`${root}/_simulados`, false);

	const discNames = discFolders.filter((d) => !d.name.startsWith("_")).map((d) => d.name);

	const simuladosAgg = useMemo(() => {
		const sims = simFiles
			.map((s) => parseSimulado(s.frontmatter, s.file?.path ?? ""))
			.filter(Boolean) as ReturnType<typeof parseSimulado>[];
		return aggregateSimulados(sims as NonNullable<ReturnType<typeof parseSimulado>>[]).sort(
			(a, b) => b.data.localeCompare(a.data),
		);
	}, [simFiles]);

	const ultimo = simuladosAgg[0];

	// Série temporal para o gráfico de evolução (ordem cronológica)
	const lineData = useMemo(
		() =>
			[...simuladosAgg]
				.sort((a, b) => a.data.localeCompare(b.data))
				.map((s, i) => ({
					idx: `#${i + 1}`,
					desempenho: Math.round(s.desempenho * 100),
				})),
		[simuladosAgg],
	);

	return (
		<Stack gap="lg" p="md" style={{ maxWidth: 1000 }}>
			<span ref={discHostRef} style={{ display: "none" }} />
			<span ref={simHostRef} style={{ display: "none" }} />

			<Group justify="space-between">
				<Title order={2}>Simulados</Title>
				<Button
					color="mint"
					leftSection={<IconPlus size={16} />}
					onClick={() => setNovoOpen(true)}
					size="sm"
				>
					Novo Simulado
				</Button>
			</Group>

			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
				<StatCard
					label="Simulados Realizados"
					value={String(simuladosAgg.length)}
				/>
				{ultimo && (
					<StatCard
						label="Último Simulado"
						sub={`${ultimo.acertos} acertos · ${ultimo.erros} erros`}
						value={`${Math.round(ultimo.desempenho * 100)}%`}
					/>
				)}
			</SimpleGrid>

			{lineData.length >= 2 && (
				<Card padding="md" radius="md" withBorder>
					<Text fw={600} mb="sm" size="sm">
						Seu Desempenho
					</Text>
					<LineChart
						curveType="bump"
						data={lineData}
						dataKey="idx"
						h={160}
						series={[{ color: "mint.5", label: "Desempenho %", name: "desempenho" }]}
						unit="%"
						withDots
						withTooltip
					/>
				</Card>
			)}

			{simuladosAgg.length === 0 ? (
				<Text c="dimmed" py="xl" size="sm" ta="center">
					Nenhum simulado registrado ainda. Crie em{" "}
					<code>{root}/_simulados/</code>.
				</Text>
			) : (
				<Stack gap="xs">
					{simuladosAgg.map((agg, i) => (
						<SimuladoCard agg={agg} index={i} key={agg.data + agg.nome} />
					))}
				</Stack>
			)}

			<NovoSimuladoModal
				app={app}
				discNames={discNames}
				onClose={() => setNovoOpen(false)}
				opened={novoOpen}
				root={root}
			/>
		</Stack>
	);
}
