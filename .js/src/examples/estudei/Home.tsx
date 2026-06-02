import { Heatmap } from "@mantine/charts";
import {
	Badge,
	Box,
	Button,
	Card,
	Group,
	Progress,
	RingProgress,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
	aggregateDesempenho,
	computeStreak,
	editalProgresso,
	progressoSemanal,
	studyMinutesByDay,
	totalDuracaoMin,
} from "@/examples/estudei/aggregate";
import { Cronometro } from "@/examples/estudei/Cronometro";
import {
	daysBetween,
	formatDuracao,
	formatPercentual,
	isoDay,
	percentBadgeColor,
} from "@/examples/estudei/format";
import {
	parseMetas,
	parseSession,
	parseTopicos,
} from "@/examples/estudei/parse";
import { StatCard } from "@/examples/estudei/StatCard";
import { parentOf } from "@/lib/markdownStore";
import {
	useApp,
	useFolderFiles,
	useMarkdownFile,
	useSubfolders,
} from "@/lib/useMarkdownFile";

const FRASES = [
	"Se você quer chegar onde a maioria não chega, faça o que a maioria não faz.",
	"A consistência supera o talento quando o talento não é consistente.",
	"Cada dia de estudo é um passo que a concorrência não deu.",
	"Não compare seu progresso com o de outros. Cada aprovação tem seu tempo.",
];

interface PainelRow {
	acertos: number;
	disciplina: string;
	discPath: string;
	erros: number;
	minutos: number;
	perc: number | null;
	progresso: number;
	total: number;
}

// ---------------------------------------------------------------------------

interface HomeProps {
	root: string;
}

export function Home({ root }: HomeProps) {
	const app = useApp();
	const today = isoDay(new Date());
	const [cronometroOpen, setCronometroOpen] = useState(false);

	// Todas as disciplinas (subpastas)
	const { items: discFolders, hostRef: discHostRef } = useSubfolders(root);
	const visibleDiscs = discFolders.filter((d) => !d.name.startsWith("_"));

	// Metas (arquivo singleton)
	const { frontmatter: metasFm, hostRef: metasHostRef } = useMarkdownFile(
		`${root}/_config/metas.md`,
	);
	const metas = parseMetas(metasFm);

	// Todos os arquivos .md do vault abaixo de `root` (recursivo)
	const { items: allFiles, hostRef: filesHostRef } = useFolderFiles(root, true);

	// Plano: lido de allFiles para garantir reatividade via o mesmo folderFiles cache
	const planoFm = useMemo(
		() => allFiles.find((f) => f.file?.path === `${root}/index.md`)?.frontmatter ?? {},
		[allFiles, root],
	);
	const dataProva =
		typeof planoFm.dataProva === "string" ? planoFm.dataProva : null;
	const planoNome =
		typeof planoFm.nome === "string" ? planoFm.nome : "Meu Plano";
	const diasParaProva = dataProva ? daysBetween(today, dataProva) : null;

	// Parse apenas os registros de estudo
	const allSessions = useMemo(
		() =>
			allFiles
				.map((s) => parseSession(s.frontmatter, s.file?.path ?? ""))
				.filter((s) => s !== null),
		[allFiles],
	);

	// Stats globais
	const totalMin = useMemo(() => totalDuracaoMin(allSessions), [allSessions]);
	const desempenho = useMemo(
		() => aggregateDesempenho(allSessions),
		[allSessions],
	);
	const byDay = useMemo(() => studyMinutesByDay(allSessions), [allSessions]);
	const streak = useMemo(
		() => computeStreak(new Set(byDay.keys()), today),
		[byDay, today],
	);
	const metasSemana = useMemo(
		() => progressoSemanal(allSessions, metas, today),
		[allSessions, metas, today],
	);

	// Heatmap data: último ano
	const heatmapData: Record<string, number> = useMemo(() => {
		const obj: Record<string, number> = {};
		for (const [day, min] of byDay) {
			obj[day] = min;
		}
		return obj;
	}, [byDay]);

	// Um ano atrás → hoje
	const heatmapStart = useMemo(() => {
		const d = new Date();
		d.setFullYear(d.getFullYear() - 1);
		return isoDay(d);
	}, []);

	// Painel por disciplina
	const painelRows: PainelRow[] = useMemo(() => {
		return visibleDiscs.map((disc) => {
			const discSessions = allSessions.filter((_s, idx) => {
				const filePath = allFiles[idx]?.file?.path ?? "";
				const discFolder = parentOf(parentOf(filePath));
				return discFolder === disc.path;
			});

			// Lê tópicos do index.md desta disciplina a partir dos arquivos já carregados
			const indexSnap = allFiles.find(
				(f) => f.file?.path === `${disc.path}/index.md`,
			);
			const topicos = indexSnap ? parseTopicos(indexSnap.frontmatter) : [];

			const desemp = aggregateDesempenho(discSessions);
			const min = totalDuracaoMin(discSessions);
			const progresso = editalProgresso(topicos);

			return {
				acertos: desemp.acertos,
				disciplina: disc.name,
				discPath: disc.path,
				erros: desemp.erros,
				minutos: min,
				perc: desemp.total > 0 ? desemp.percentual : null,
				progresso,
				total: desemp.total,
			};
		});
	}, [visibleDiscs, allSessions, allFiles]);

	const frase = FRASES[streak % FRASES.length];

	return (
		<Stack gap="lg" p="md" style={{ maxWidth: 1100 }}>
			{/* Hidden anchors para poda de assinantes órfãos */}
			<span ref={discHostRef} style={{ display: "none" }} />
			<span ref={metasHostRef} style={{ display: "none" }} />
			<span ref={filesHostRef} style={{ display: "none" }} />

			{/* Cabeçalho */}
			<Group justify="space-between" wrap="nowrap">
				<Title order={2}>Home</Title>
				<Group gap="xs">
					<Button
						color="mint"
						leftSection={<IconPlus size={16} />}
						onClick={() => setCronometroOpen(true)}
						size="sm"
						variant="filled"
					>
						Adicionar Estudo
					</Button>
					{planoNome && (
						<Badge color="mint" size="lg" variant="light">
							{planoNome}
						</Badge>
					)}
				</Group>
			</Group>

			{/* Stat cards */}
			<SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
				<StatCard
					label="Tempo de Estudo"
					sub={`${allSessions.length} sessões`}
					value={formatDuracao(totalMin)}
				/>
				<StatCard
					label="Desempenho"
					sub={
						desempenho.total > 0 ? (
							<>
								<Text c="green" component="span" size="xs">
									{desempenho.acertos} acertos
								</Text>{" "}
								·{" "}
								<Text c="red" component="span" size="xs">
									{desempenho.erros} erros
								</Text>
							</>
						) : (
							"—"
						)
					}
					value={formatPercentual(
						desempenho.total > 0 ? desempenho.percentual : null,
					)}
				/>
				<StatCard
					label="Progresso no Edital"
					sub={`${visibleDiscs.length} disciplinas`}
					value={(() => {
						const _allTopics = painelRows.flatMap(() => []);
						const totalTopics = painelRows.reduce((acc) => acc, 0);
						void totalTopics;
						// Progresso médio entre disciplinas
						const percs = painelRows
							.map((r) => r.progresso)
							.filter((p) => p > 0);
						return formatPercentual(
							percs.length > 0
								? percs.reduce((a, b) => a + b, 0) / painelRows.length
								: null,
						);
					})()}
				/>
				<Card padding="md" radius="md" withBorder>
					<Text
						c="dimmed"
						fw={600}
						size="xs"
						style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
					>
						{diasParaProva !== null ? "Dias para a Prova" : "Motivação"}
					</Text>
					{diasParaProva !== null ? (
						<>
							<Text fw={700} mt={4} size="xl">
								{diasParaProva}
							</Text>
							<Text c="dimmed" mt={2} size="xs">
								{dataProva}
							</Text>
						</>
					) : (
						<Text fw={500} mt={4} size="sm" style={{ fontStyle: "italic" }}>
							{frase}
						</Text>
					)}
				</Card>
			</SimpleGrid>

			{/* Constância */}
			<Card padding="md" radius="md" withBorder>
				<Group justify="space-between" mb="xs" wrap="nowrap">
					<Text fw={600} size="sm">
						Constância nos Estudos
					</Text>
					<Group gap="xs">
						<Badge
							color={streak > 0 ? "mint" : "red"}
							size="sm"
							variant="light"
						>
							{streak > 0 ? `🔥 ${streak} dias sem falhar` : "Comece hoje!"}
						</Badge>
					</Group>
				</Group>
				<Box style={{ overflowX: "auto" }}>
					<Heatmap
						data={heatmapData}
						endDate={today}
						gap={2}
						getTooltipLabel={({ date, value }) =>
							`${date}: ${formatDuracao(value ?? 0)}`
						}
						monthLabels={[
							"Jan",
							"Fev",
							"Mar",
							"Abr",
							"Mai",
							"Jun",
							"Jul",
							"Ago",
							"Set",
							"Out",
							"Nov",
							"Dez",
						]}
						rectRadius={2}
						rectSize={14}
						startDate={heatmapStart}
						weekdayLabels={["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]}
						withMonthLabels
						withTooltip
						withWeekdayLabels
					/>
				</Box>
			</Card>

			{/* Painel de disciplinas + Metas semanais */}
			<Group align="flex-start" gap="md" wrap="nowrap">
				{/* Painel tabela */}
				<Card
					padding="md"
					radius="md"
					style={{ flex: 1, minWidth: 0 }}
					withBorder
				>
					<Title mb="sm" order={5}>
						Painel
					</Title>
					<Table.ScrollContainer minWidth={400}>
						<Table highlightOnHover verticalSpacing="xs">
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Disciplinas</Table.Th>
									<Table.Th style={{ textAlign: "right" }}>Tempo</Table.Th>
									<Table.Th style={{ textAlign: "center" }}>✓</Table.Th>
									<Table.Th style={{ textAlign: "center" }}>✗</Table.Th>
									<Table.Th style={{ textAlign: "center" }}>∑</Table.Th>
									<Table.Th style={{ textAlign: "center" }}>%</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{painelRows.length === 0 ? (
									<Table.Tr>
										<Table.Td colSpan={6}>
											<Text c="dimmed" py="sm" size="sm" ta="center">
												Nenhuma disciplina encontrada em <code>{root}/</code>.
											</Text>
										</Table.Td>
									</Table.Tr>
								) : (
									painelRows.map((row) => (
										<Table.Tr key={row.disciplina}>
											<Table.Td>
												<Text fw={500} size="sm">
													{row.disciplina}
												</Text>
											</Table.Td>
											<Table.Td
												style={{ textAlign: "right", whiteSpace: "nowrap" }}
											>
												<Text size="sm">{formatDuracao(row.minutos)}</Text>
											</Table.Td>
											<Table.Td style={{ textAlign: "center" }}>
												<Text c="green" size="sm">
													{row.acertos}
												</Text>
											</Table.Td>
											<Table.Td style={{ textAlign: "center" }}>
												<Text c="red" size="sm">
													{row.erros}
												</Text>
											</Table.Td>
											<Table.Td style={{ textAlign: "center" }}>
												<Text size="sm">{row.total}</Text>
											</Table.Td>
											<Table.Td style={{ textAlign: "center" }}>
												<Badge
													color={percentBadgeColor(row.perc)}
													size="sm"
													variant="filled"
												>
													{formatPercentual(row.perc)}
												</Badge>
											</Table.Td>
										</Table.Tr>
									))
								)}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				</Card>

				{/* Metas semanais */}
				<Card padding="md" radius="md" style={{ minWidth: 200 }} withBorder>
					<Title mb="md" order={5}>
						Metas da Semana
					</Title>
					<Stack gap="sm">
						<Box>
							<Group justify="space-between" mb={4}>
								<Text size="xs">Horas de Estudo</Text>
								<Text c="dimmed" size="xs">
									{formatDuracao(Math.round(metasSemana.horasFeitas * 60))} /{" "}
									{metasSemana.horasAlvo}h
								</Text>
							</Group>
							<Progress
								color="mint"
								radius="sm"
								size="sm"
								value={Math.min(
									100,
									(metasSemana.horasFeitas / metasSemana.horasAlvo) * 100,
								)}
							/>
						</Box>
						<Box>
							<Group justify="space-between" mb={4}>
								<Text size="xs">Questões</Text>
								<Text c="dimmed" size="xs">
									{metasSemana.questoesFeitas} / {metasSemana.questoesAlvo}
								</Text>
							</Group>
							<Progress
								color="mint"
								radius="sm"
								size="sm"
								value={Math.min(
									100,
									(metasSemana.questoesFeitas / metasSemana.questoesAlvo) * 100,
								)}
							/>
						</Box>
						{desempenho.total > 0 && (
							<Box mt="xs">
								<Text mb="xs" size="xs" ta="center">
									Desempenho Geral
								</Text>
								<RingProgress
									label={
										<Text fw={700} size="sm" ta="center">
											{Math.round(desempenho.percentual * 100)}%
										</Text>
									}
									sections={[
										{
											color: "mint",
											value: Math.round(desempenho.percentual * 100),
										},
									]}
									size={90}
									thickness={8}
								/>
							</Box>
						)}
					</Stack>
				</Card>
			</Group>

			{/* Cronômetro */}
			<Cronometro
				app={app}
				disciplinas={discFolders}
				onClose={() => setCronometroOpen(false)}
				opened={cronometroOpen}
				root={root}
			/>
		</Stack>
	);
}
