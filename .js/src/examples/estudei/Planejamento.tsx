import { DonutChart } from "@mantine/charts";
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
	SimpleGrid,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { cicloProgresso } from "@/examples/estudei/aggregate";
import { formatDuracao, isoDay } from "@/examples/estudei/format";
import { parseCiclo, parseSession } from "@/examples/estudei/parse";
import {
	parentOf,
	useFolderFiles,
	useMarkdownFile,
	useSubfolders,
} from "@/lib";

const DISC_COLORS = [
	"mint.5", "blue.5", "grape.5", "orange.5", "pink.5",
	"teal.5", "cyan.5", "yellow.5", "red.5", "violet.5",
];

interface PlanejamentoProps {
	root: string;
}

// ---------------------------------------------------------------------------
// Modal de edição do ciclo

interface EditCicloModalProps {
	cicloPath: string;
	discNames: string[];
	onClose: () => void;
	opened: boolean;
}

function EditCicloModal({ opened, onClose, cicloPath, discNames }: EditCicloModalProps) {
	const { frontmatter, update } = useMarkdownFile(cicloPath);
	const ciclo = parseCiclo(frontmatter);
	const [items, setItems] = useState<{ nome: string; minutosAlvo: number }[]>(
		() => ciclo?.disciplinas ?? [],
	);

	const handleSave = () => {
		update((fm) => {
			fm.tipo = "ciclo";
			fm.disciplinas = items.map((i) => ({ minutosAlvo: i.minutosAlvo, nome: i.nome }));
		});
		onClose();
	};

	const addItem = () => setItems((prev) => [...prev, { minutosAlvo: 45, nome: discNames[0] ?? "" }]);
	const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
	const updateItem = (idx: number, field: "nome" | "minutosAlvo", value: string | number) => {
		setItems((prev) =>
			prev.map((item, i) =>
				i === idx ? { ...item, [field]: field === "minutosAlvo" ? Number(value) : value } : item,
			),
		);
	};

	return (
		<Modal
			centered
			onClose={onClose}
			opened={opened}
			size="md"
			title={<Text fw={700}>Editar Ciclo</Text>}
		>
			<Stack gap="sm">
				{items.map((item, idx) => (
					<Group gap="xs" key={idx} wrap="nowrap">
						<TextInput
							list="disc-list"
							onChange={(e) => updateItem(idx, "nome", e.currentTarget.value)}
							placeholder="Disciplina"
							style={{ flex: 1 }}
							value={item.nome}
						/>
						<datalist id="disc-list">
							{discNames.map((n) => (
								<option key={n} value={n} />
							))}
						</datalist>
						<NumberInput
							min={5}
							onChange={(v) => updateItem(idx, "minutosAlvo", v || 45)}
							placeholder="min"
							style={{ width: 80 }}
							suffix=" min"
							value={item.minutosAlvo}
						/>
						<ActionIcon color="red" onClick={() => removeItem(idx)} variant="subtle">
							<IconTrash size={14} />
						</ActionIcon>
					</Group>
				))}
				<Button
					leftSection={<IconPlus size={14} />}
					onClick={addItem}
					size="xs"
					variant="subtle"
				>
					Adicionar item
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
// Tela principal

export function Planejamento({ root }: PlanejamentoProps) {
	const today = isoDay(new Date());
	const cicloPath = `${root}/_config/ciclo.md`;

	const { items: discFolders } = useSubfolders(root);
	const { items: allFiles } = useFolderFiles(root, true);
	const { frontmatter: cicloFm, update: updateCiclo } = useMarkdownFile(cicloPath);

	const [editOpen, setEditOpen] = useState(false);
	const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

	const ciclo = parseCiclo(cicloFm);
	const discNames = discFolders.filter((d) => !d.name.startsWith("_")).map((d) => d.name);

	// Sessões agrupadas por disciplina
	const sessionsByDisc = useMemo(() => {
		const map = new Map<string, ReturnType<typeof parseSession>[]>();
		for (const snap of allFiles) {
			const path = snap.file?.path ?? "";
			const session = parseSession(snap.frontmatter, path);
			if (!session) continue;
			const discPath = parentOf(parentOf(path));
			const discName = discPath.split("/").at(-1) ?? "";
			const arr = map.get(discName) ?? [];
			arr.push(session);
			map.set(discName, arr);
		}
		return map;
	}, [allFiles]);

	const sessionsByDiscArr = useMemo(
		() =>
			[...sessionsByDisc.entries()].map(([disciplina, sessions]) => ({
				disciplina,
				sessions: sessions.filter(Boolean) as NonNullable<ReturnType<typeof parseSession>>[],
			})),
		[sessionsByDisc],
	);

	const prog = useMemo(
		() =>
			ciclo
				? cicloProgresso(ciclo, sessionsByDiscArr)
				: { itens: [], minutosFeitos: 0, minutosTotal: 0, progresso: 0 },
		[ciclo, sessionsByDiscArr],
	);

	const handleRecomecar = () => {
		updateCiclo((fm) => {
			fm.tipo = "ciclo";
			fm.iniciado = today;
			fm.cicloConcluido = (typeof fm.cicloConcluido === "number" ? fm.cicloConcluido : 0) + 1;
		});
	};

	// Dados do donut: disciplinas únicas com tempo total alvo
	const donutData = useMemo(() => {
		const seen = new Map<string, number>();
		if (ciclo) {
			for (const d of ciclo.disciplinas) {
				seen.set(d.nome, (seen.get(d.nome) ?? 0) + d.minutosAlvo);
			}
		}
		return [...seen.entries()].map(([name, value], i) => ({
			color: DISC_COLORS[i % DISC_COLORS.length],
			name,
			value,
		}));
	}, [ciclo]);

	if (!ciclo) {
		return (
			<Stack gap="md" p="md">
				<Title order={2}>Planejamento</Title>
				<Text c="dimmed" size="sm">
					Nenhum ciclo configurado em{" "}
					<code>{root}/_config/ciclo.md</code>.
				</Text>
				<Button
					color="mint"
					onClick={() => setEditOpen(true)}
					size="sm"
					style={{ alignSelf: "flex-start" }}
				>
					Criar Ciclo
				</Button>
				<EditCicloModal
					cicloPath={cicloPath}
					discNames={discNames}
					onClose={() => setEditOpen(false)}
					opened={editOpen}
				/>
			</Stack>
		);
	}

	const progressoPerc = Math.round(prog.progresso * 100);

	return (
		<Stack gap="lg" p="md" style={{ maxWidth: 1000 }}>
			<Group justify="space-between" wrap="nowrap">
				<Title order={2}>Planejamento</Title>
				<Group gap="xs">
					<Button color="mint" onClick={handleRecomecar} size="sm" variant="light">
						Recomeçar Ciclo
					</Button>
					<Button onClick={() => setEditOpen(true)} size="sm" variant="subtle">
						Editar
					</Button>
				</Group>
			</Group>

			{/* Resumo */}
			<Group align="flex-start" gap="md" wrap="nowrap">
				<Stack gap="md" style={{ flex: 1 }}>
					<SimpleGrid cols={2} spacing="sm">
						<Card padding="md" radius="md" withBorder>
							<Text c="dimmed" fw={600} size="xs" tt="uppercase">
								Ciclos Completos
							</Text>
							<Text fw={700} mt={4} size="xl">
								{ciclo.cicloConcluido}
							</Text>
						</Card>
						<Card padding="md" radius="md" withBorder>
							<Text c="dimmed" fw={600} size="xs" tt="uppercase">
								Progresso
							</Text>
							<Text fw={700} mt={4} size="xl">
								{progressoPerc}%
							</Text>
							<Progress
								color="mint"
								mt={6}
								radius="sm"
								size="sm"
								value={progressoPerc}
							/>
							<Text c="dimmed" mt={4} size="xs">
								{formatDuracao(prog.minutosFeitos)} / {formatDuracao(prog.minutosTotal)}
							</Text>
						</Card>
					</SimpleGrid>

					{/* Sequência */}
					<Card padding="md" radius="md" withBorder>
						<Text fw={600} mb="sm" size="sm">
							Sequência dos Estudos
						</Text>
						<Stack gap="xs">
							{prog.itens.map((item, idx) => {
								const feitos = Math.min(item.minutosFeitos, item.minutosAlvo);
								const perc = item.minutosAlvo > 0 ? (feitos / item.minutosAlvo) * 100 : 0;
								const isOpen = expandedIdx === idx;
								return (
									<Box key={idx}>
										<Card
											onClick={() => setExpandedIdx(isOpen ? null : idx)}
											padding="xs"
											radius="sm"
											style={{ cursor: "pointer" }}
											withBorder
										>
											<Group justify="space-between" wrap="nowrap">
												<Group gap="xs">
													{item.concluido ? (
														<Badge color="mint" size="xs" variant="filled">
															✓
														</Badge>
													) : (
														<Box
															style={{
																background: "var(--mantine-color-gray-3)",
																borderRadius: 4,
																height: 16,
																width: 16,
															}}
														/>
													)}
													<Text fw={500} size="sm">
														{item.nome}
													</Text>
												</Group>
												<Group gap="xs">
													<Text c="dimmed" size="xs">
														{formatDuracao(item.minutosFeitos)} /{" "}
														{formatDuracao(item.minutosAlvo)}
													</Text>
													{isOpen ? (
														<IconChevronUp size={14} />
													) : (
														<IconChevronDown size={14} />
													)}
												</Group>
											</Group>
											<Progress
												color={item.concluido ? "mint" : "blue"}
												mt={4}
												radius="xs"
												size="xs"
												value={Math.min(100, perc)}
											/>
										</Card>
										<Collapse in={isOpen}>
											<Box
												p="xs"
												style={{
													background: "var(--mantine-color-gray-0)",
													borderRadius: "0 0 8px 8px",
												}}
											>
												<Text c="dimmed" size="xs">
													{ciclo.iniciado
														? `Sessões desde ${ciclo.iniciado}`
														: "Todas as sessões"}
												</Text>
											</Box>
										</Collapse>
									</Box>
								);
							})}
						</Stack>
					</Card>
				</Stack>

				{/* Gráfico de rosca */}
				{donutData.length > 0 && (
					<Card padding="md" radius="md" style={{ minWidth: 200 }} withBorder>
						<Text fw={600} mb="sm" size="sm" ta="center">
							Ciclo
						</Text>
						<DonutChart
							data={donutData}
							h={160}
							paddingAngle={2}
							size={160}
							thickness={24}
							tooltipDataSource="segment"
						/>
						<Text c="dimmed" mt={4} size="xs" ta="center">
							{formatDuracao(prog.minutosTotal)}
						</Text>
					</Card>
				)}
			</Group>

			<EditCicloModal
				cicloPath={cicloPath}
				discNames={discNames}
				onClose={() => setEditOpen(false)}
				opened={editOpen}
			/>
		</Stack>
	);
}
