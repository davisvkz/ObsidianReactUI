import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Group,
	Stack,
	Tabs,
	Text,
	Title,
} from "@mantine/core";
import { IconPlayerPlay, IconPlus, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
	formatDuracao,
	isoDay,
	percentBadgeColor,
} from "@/examples/estudei/format";
import { parseRevisoesConfig, parseSession, revisaoKey } from "@/examples/estudei/parse";
import { revisoesPendentes } from "@/examples/estudei/revisao";
import type { RevisaoOcorrencia } from "@/examples/estudei/revisao";
import { Cronometro } from "@/examples/estudei/Cronometro";
import {
	parentOf,
	useApp,
	useFolderFiles,
	useMarkdownFile,
	useSubfolders,
} from "@/lib";

interface RevisoesProps {
	root: string;
}

// ---------------------------------------------------------------------------
// Renderiza um card de revisão individual

interface RevisaoCardProps {
	onIgnorar: () => void;
	onIniciar: () => void;
	rev: RevisaoOcorrencia;
	sessaoInfo: { discName: string; session: ReturnType<typeof parseSession> } | undefined;
}

function RevisaoCard({ rev, sessaoInfo, onIniciar, onIgnorar }: RevisaoCardProps) {
	const session = sessaoInfo?.session;
	const discName = sessaoInfo?.discName ?? rev.registroId.split("/").slice(-3, -2)[0] ?? "?";

	const categoriaColor: Record<string, string> = {
		TEORIA: "blue",
		QUESTOES: "grape",
		REVISAO: "teal",
		LEITURA_LEI: "orange",
		VIDEOAULA: "pink",
		RESUMO: "cyan",
	};

	return (
		<Card padding="sm" radius="md" withBorder>
			<Group justify="space-between" wrap="nowrap">
				<Group gap="xs" wrap="nowrap">
					<Badge
						color={rev.status === "atrasada" ? "red" : "mint"}
						size="sm"
						variant="light"
					>
						{rev.offsetDias === 1 ? "1 dia" : `${rev.offsetDias} dias`}
					</Badge>
					<Text fw={600} size="sm" tt="uppercase">
						{discName}
					</Text>
					{rev.topicoId && (
						<Text c="dimmed" size="xs">
							tópico {rev.topicoId}
						</Text>
					)}
				</Group>
				<Group gap={4} wrap="nowrap">
					<ActionIcon
						aria-label="iniciar revisão"
						color="mint"
						onClick={onIniciar}
						size="sm"
						variant="light"
					>
						<IconPlayerPlay size={12} />
					</ActionIcon>
					<ActionIcon
						aria-label="ignorar revisão"
						color="gray"
						onClick={onIgnorar}
						size="sm"
						variant="subtle"
					>
						<IconX size={12} />
					</ActionIcon>
				</Group>
			</Group>
			{session && (
				<Group gap="md" mt={6} wrap="wrap">
					<Text c="dimmed" size="xs">
						Estudado: {session.data}
					</Text>
					<Badge
						color={categoriaColor[session.categoria] ?? "gray"}
						size="xs"
						variant="filled"
					>
						{session.categoria.replace(/_/g, " ")}
					</Badge>
					<Text size="xs">{formatDuracao(session.duracaoMin)}</Text>
					{session.acertos + session.erros > 0 && (
						<>
							<Text c="green" size="xs">
								{session.acertos} ✓
							</Text>
							<Text c="red" size="xs">
								{session.erros} ✗
							</Text>
							<Badge
								color={percentBadgeColor(
									session.acertos / (session.acertos + session.erros),
								)}
								size="xs"
								variant="filled"
							>
								{Math.round(
									(session.acertos / (session.acertos + session.erros)) * 100,
								)}
								%
							</Badge>
						</>
					)}
				</Group>
			)}
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Renderiza uma lista de revisões agrupadas por data

interface RevisoesListProps {
	onIgnorar: (registroId: string, offsetDias: number) => void;
	onIniciar: (registroId: string, topicoId?: string) => void;
	revs: RevisaoOcorrencia[];
	sessaoByPath: Map<string, { discName: string; session: ReturnType<typeof parseSession> }>;
	today: string;
}

function RevisoesList({ revs, sessaoByPath, today, onIniciar, onIgnorar }: RevisoesListProps) {
	const grouped = useMemo(() => {
		const m = new Map<string, RevisaoOcorrencia[]>();
		for (const r of revs) {
			const arr = m.get(r.data) ?? [];
			arr.push(r);
			m.set(r.data, arr);
		}
		return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [revs]);

	if (grouped.length === 0) {
		return (
			<Text c="dimmed" py="xl" size="sm" ta="center">
				Nenhuma revisão aqui.
			</Text>
		);
	}

	return (
		<Stack gap="lg">
			{grouped.map(([date, dateRevs]) => (
				<Box key={date}>
					<Text fw={700} mb="xs" size="xs" tt="uppercase">
						{date === today ? "HOJE" : date}
					</Text>
					<Stack gap="xs">
						{dateRevs.map((rev) => (
							<RevisaoCard
								key={`${rev.registroId}:${rev.offsetDias}`}
								onIgnorar={() => onIgnorar(rev.registroId, rev.offsetDias)}
								onIniciar={() => onIniciar(rev.registroId, rev.topicoId)}
								rev={rev}
								sessaoInfo={sessaoByPath.get(rev.registroId)}
							/>
						))}
					</Stack>
				</Box>
			))}
		</Stack>
	);
}

// ---------------------------------------------------------------------------
// Tela principal

export function Revisoes({ root }: RevisoesProps) {
	const app = useApp();
	const today = isoDay(new Date());

	const { items: discFolders } = useSubfolders(root);
	const { items: allFiles } = useFolderFiles(root, true);
	const {
		frontmatter: revisoesConfigFm,
		update: updateRevisoes,
	} = useMarkdownFile(`${root}/_config/revisoes.md`);

	const [cronometroOpen, setCronometroOpen] = useState(false);
	const [cronometroInit, setCronometroInit] = useState<
		{ disciplina?: string; topicoId?: string } | undefined
	>();

	const revisoesConfig = useMemo(
		() => parseRevisoesConfig(revisoesConfigFm),
		[revisoesConfigFm],
	);
	const ignoradasSet = useMemo(
		() => new Set(revisoesConfig.ignoradas.map((k) => revisaoKey(k.registroId, k.offsetDias))),
		[revisoesConfig],
	);

	// Mapa path → { session, discName }
	const sessaoByPath = useMemo(() => {
		const map = new Map<string, { discName: string; session: ReturnType<typeof parseSession> }>();
		for (const snap of allFiles) {
			const path = snap.file?.path ?? "";
			const session = parseSession(snap.frontmatter, path);
			if (!session) continue;
			const discPath = parentOf(parentOf(path));
			const discName = discPath.split("/").at(-1) ?? "";
			map.set(path, { discName, session });
		}
		return map;
	}, [allFiles]);

	// Todas as revisões projetadas
	const todasRevisoes = useMemo(() => {
		const sessionEntries: { session: ReturnType<typeof parseSession>; id: string }[] = [];
		for (const [path, { session }] of sessaoByPath) {
			if (session?.geraRevisao) sessionEntries.push({ id: path, session });
		}
		return revisoesPendentes(
			sessionEntries as { session: NonNullable<ReturnType<typeof parseSession>>; id: string }[],
			today,
		);
	}, [sessaoByPath, today]);

	const programadas = useMemo(
		() =>
			todasRevisoes.filter(
				(r) =>
					r.status === "programada" &&
					!ignoradasSet.has(revisaoKey(r.registroId, r.offsetDias)),
			),
		[todasRevisoes, ignoradasSet],
	);
	const atrasadas = useMemo(
		() =>
			todasRevisoes.filter(
				(r) =>
					r.status === "atrasada" &&
					!ignoradasSet.has(revisaoKey(r.registroId, r.offsetDias)),
			),
		[todasRevisoes, ignoradasSet],
	);
	const ignoradas = useMemo(
		() =>
			todasRevisoes.filter((r) =>
				ignoradasSet.has(revisaoKey(r.registroId, r.offsetDias)),
			),
		[todasRevisoes, ignoradasSet],
	);

	const handleIgnorar = (registroId: string, offsetDias: number) => {
		updateRevisoes((fm) => {
			if (!Array.isArray(fm.ignoradas)) fm.ignoradas = [];
			const key = revisaoKey(registroId, offsetDias);
			if (!(fm.ignoradas as string[]).includes(key)) {
				(fm.ignoradas as string[]).push(key);
			}
			if (!fm.tipo) fm.tipo = "revisoes";
		});
	};

	const handleIniciar = (registroId: string, topicoId?: string) => {
		const info = sessaoByPath.get(registroId);
		setCronometroInit({ disciplina: info?.discName, topicoId });
		setCronometroOpen(true);
	};

	const listProps = { sessaoByPath, today, onIniciar: handleIniciar, onIgnorar: handleIgnorar };

	return (
		<Stack gap="md" p="md" style={{ maxWidth: 900 }}>
			<Group justify="space-between">
				<Title order={2}>Revisões</Title>
				<Button
					color="mint"
					leftSection={<IconPlus size={16} />}
					onClick={() => {
						setCronometroInit(undefined);
						setCronometroOpen(true);
					}}
					size="sm"
				>
					Adicionar Estudo
				</Button>
			</Group>

			<Tabs defaultValue="programadas" keepMounted={false}>
				<Tabs.List>
					<Tabs.Tab value="programadas">
						PROGRAMADAS
						{programadas.length > 0 && (
							<Badge color="mint" ml={6} size="xs" variant="light">
								{programadas.length}
							</Badge>
						)}
					</Tabs.Tab>
					<Tabs.Tab value="atrasadas">
						ATRASADAS
						{atrasadas.length > 0 && (
							<Badge color="red" ml={6} size="xs">
								{atrasadas.length}
							</Badge>
						)}
					</Tabs.Tab>
					<Tabs.Tab value="ignoradas">IGNORADAS</Tabs.Tab>
					<Tabs.Tab value="concluidas">CONCLUÍDAS</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel pt="md" value="programadas">
					<RevisoesList revs={programadas} {...listProps} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="atrasadas">
					<RevisoesList revs={atrasadas} {...listProps} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="ignoradas">
					<RevisoesList revs={ignoradas} {...listProps} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="concluidas">
					<Text c="dimmed" py="xl" size="sm" ta="center">
						Em breve: sessões com categoria REVISÃO correspondentes a um registro
						aparecerão aqui.
					</Text>
				</Tabs.Panel>
			</Tabs>

			<Cronometro
				app={app}
				disciplinas={discFolders}
				initial={cronometroInit}
				onClose={() => setCronometroOpen(false)}
				opened={cronometroOpen}
				root={root}
			/>
		</Stack>
	);
}
