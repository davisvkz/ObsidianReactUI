import { BarChart, CompositeChart } from "@mantine/charts";
import {
	Card,
	Group,
	RingProgress,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useMemo } from "react";
import {
	aggregateEstatisticas,
	buildTimeSeries,
	editalProgresso,
} from "@/examples/estudei/aggregate";
import {
	formatDuracao,
	formatPercentual,
	isoDay,
} from "@/examples/estudei/format";
import { parseSession, parseTopicos } from "@/examples/estudei/parse";
import { StatCard } from "@/examples/estudei/StatCard";
import { parentOf, useFolderFiles } from "@/lib";

interface EstatisticasProps {
	root: string;
}

export function Estatisticas({ root }: EstatisticasProps) {
	const today = isoDay(new Date());

	const { items: allFiles } = useFolderFiles(root, true);

	const allSessions = useMemo(
		() =>
			allFiles
				.map((s) => parseSession(s.frontmatter, s.file?.path ?? ""))
				.filter(Boolean) as NonNullable<ReturnType<typeof parseSession>>[],
		[allFiles],
	);

	// Data mais antiga de estudo ou hoje
	const fromDate = useMemo(() => {
		if (allSessions.length === 0) return today;
		return [...allSessions].sort((a, b) => a.data.localeCompare(b.data))[0].data;
	}, [allSessions, today]);

	const stats = useMemo(
		() => aggregateEstatisticas(allSessions, fromDate, today),
		[allSessions, fromDate, today],
	);

	// Tópicos de todas as disciplinas (para progresso no edital)
	const allTopicos = useMemo(() => {
		return allFiles
			.filter((f) => {
				const path = f.file?.path ?? "";
				// index.md direto de disciplina (2 níveis abaixo de root)
				const parent = parentOf(path);
				const grandParent = parentOf(parent);
				return (
					path.endsWith("/index.md") &&
					grandParent === root &&
					!parent.split("/").at(-1)?.startsWith("_")
				);
			})
			.flatMap((f) => parseTopicos(f.frontmatter));
	}, [allFiles, root]);

	const editalProg = editalProgresso(allTopicos);
	const topicosConc = allTopicos.filter((t) => t.concluido).length;
	const topicosPend = allTopicos.length - topicosConc;

	// Série temporal para os gráficos (últimos 30 dias)
	const thirtyDaysAgo = useMemo(() => {
		const d = new Date();
		d.setDate(d.getDate() - 29);
		return isoDay(d);
	}, []);

	const recentSessions = useMemo(
		() => allSessions.filter((s) => s.data >= thirtyDaysAgo),
		[allSessions, thirtyDaysAgo],
	);

	const timeSeries = useMemo(
		() => buildTimeSeries(recentSessions, thirtyDaysAgo, today),
		[recentSessions, thirtyDaysAgo, today],
	);

	const compositeData = useMemo(
		() =>
			timeSeries
				.filter((p) => p.acertos + p.erros > 0 || p.minutos > 0)
				.map((p) => {
					const q = p.acertos + p.erros;
					return {
						day: p.day.slice(5), // MM-DD
						desempenho: q > 0 ? Math.round((p.acertos / q) * 100) : null,
						questoes: q,
					};
				}),
		[timeSeries],
	);

	const horasData = useMemo(
		() =>
			timeSeries
				.filter((p) => p.minutos > 0)
				.map((p) => ({
					day: p.day.slice(5),
					horas: Math.round((p.minutos / 60) * 10) / 10,
				})),
		[timeSeries],
	);

	const mediaMinPorDia =
		stats.diasEstudados > 0 ? Math.round(stats.totalMin / stats.diasEstudados) : 0;

	return (
		<Stack gap="lg" p="md" style={{ maxWidth: 1100 }}>
			<Title order={2}>Estatísticas</Title>

			{/* Cards de resumo */}
			<SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
				{/* Desempenho */}
				<Card padding="md" radius="md" withBorder>
					<Text
						c="dimmed"
						fw={600}
						size="xs"
						style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
					>
						Desempenho
					</Text>
					<Group gap="xs" mt={4} wrap="nowrap">
						<RingProgress
							label={
								<Text fw={700} size="xs" ta="center">
									{formatPercentual(
										stats.desempenho.total > 0 ? stats.desempenho.percentual : null,
									)}
								</Text>
							}
							sections={[
								{
									color: "mint",
									value:
										stats.desempenho.total > 0
											? Math.round(stats.desempenho.percentual * 100)
											: 0,
								},
							]}
							size={70}
							thickness={6}
						/>
						<Stack gap={0}>
							<Text c="green" size="xs">
								{stats.desempenho.acertos} ✓
							</Text>
							<Text c="red" size="xs">
								{stats.desempenho.erros} ✗
							</Text>
							<Text c="dimmed" size="xs">
								{stats.desempenho.total} total
							</Text>
						</Stack>
					</Group>
				</Card>

				{/* Tempo de estudo */}
				<StatCard
					label="Tempo de Estudo"
					sub={`${formatDuracao(mediaMinPorDia)}/dia · ${stats.diasEstudados} dias`}
					value={formatDuracao(stats.totalMin)}
				/>

				{/* Constância */}
				<StatCard
					label="Constância"
					sub={`${stats.diasEstudados} estudados / ${stats.diasTotais} dias`}
					value={formatPercentual(stats.constancia)}
				/>

				{/* Páginas lidas */}
				<StatCard
					label="Páginas Lidas"
					sub={`${stats.paginasPorHora.toFixed(1)} pag/hora`}
					value={String(stats.paginasLidas)}
				/>

				{/* Videoaulas */}
				<StatCard
					label="Videoaulas"
					sub="tempo total"
					value={formatDuracao(stats.videoaulaMin)}
				/>

				{/* Progresso no edital */}
				<StatCard
					label="Progresso no Edital"
					sub={`${topicosConc} concluídos · ${topicosPend} pendentes`}
					value={formatPercentual(editalProg > 0 ? editalProg : null)}
				/>
			</SimpleGrid>

			{/* Evolução no tempo */}
			{compositeData.length >= 2 && (
				<Card padding="md" radius="md" withBorder>
					<Text fw={600} mb="sm" size="sm">
						Evolução no Tempo (últimos 30 dias)
					</Text>
					<CompositeChart
						data={compositeData}
						dataKey="day"
						h={220}
						maxBarWidth={20}
						series={[
							{ color: "mint.4", name: "questoes", type: "bar" },
							{ color: "violet.6", name: "desempenho", type: "line" },
						]}
						withLegend
						withTooltip
					/>
				</Card>
			)}

			{/* Horas de estudo */}
			{horasData.length >= 2 && (
				<Card padding="md" radius="md" withBorder>
					<Text fw={600} mb="sm" size="sm">
						Horas de Estudo (últimos 30 dias)
					</Text>
					<BarChart
						data={horasData}
						dataKey="day"
						h={180}
						maxBarWidth={20}
						series={[{ color: "mint.5", label: "Horas", name: "horas" }]}
						unit="h"
						withTooltip
					/>
				</Card>
			)}

			{allSessions.length === 0 && (
				<Text c="dimmed" py="xl" size="sm" ta="center">
					Nenhum registro de estudo encontrado em <code>{root}/</code>.
				</Text>
			)}
		</Stack>
	);
}
