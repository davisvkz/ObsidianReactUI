import { useEffect } from "react";
import {
	ActionIcon,
	Badge,
	Button,
	Group,
	Modal,
	NumberInput,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import {
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerStop,
} from "@tabler/icons-react";
import type { App } from "obsidian";
import { useState } from "react";
import { isoDay, sessionFileName } from "@/examples/estudei/format";
import type { Categoria } from "@/examples/estudei/parse";
import type { Subfolder } from "@/lib/markdownStore";

interface CronometroProps {
	app: App;
	disciplinas: Subfolder[];
	/** Valores pré-preenchidos ao abrir (ex: ao iniciar uma revisão). */
	initial?: { disciplina?: string; topicoId?: string };
	onClose: () => void;
	opened: boolean;
	root: string;
}

const CATEGORIAS: { value: Categoria; label: string }[] = [
	{ label: "Teoria", value: "TEORIA" },
	{ label: "Questões", value: "QUESTOES" },
	{ label: "Revisão", value: "REVISAO" },
	{ label: "Leitura de Lei", value: "LEITURA_LEI" },
	{ label: "Videoaula", value: "VIDEOAULA" },
	{ label: "Resumo", value: "RESUMO" },
];

function formatHMS(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Modal de cronômetro — registra uma sessão de estudo no vault. */
export function Cronometro({
	app,
	root,
	disciplinas,
	initial,
	opened,
	onClose,
}: CronometroProps) {
	const [running, setRunning] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [startTime, setStartTime] = useState<Date | null>(null);

	const [disciplina, setDisciplina] = useState<string | null>(
		disciplinas[0]?.name ?? null,
	);
	const [categoria, setCategoria] = useState<Categoria>("TEORIA");
	const [topicoId, setTopicoId] = useState("");
	const [acertos, setAcertos] = useState<number | string>(0);
	const [erros, setErros] = useState<number | string>(0);
	const [material, setMaterial] = useState("");
	const [paginas, setPaginas] = useState<number | string>(0);
	const [geraRevisao, _setGeraRevisao] = useState(true);

	const interval = useInterval(() => setSeconds((s) => s + 1), 1000);

	// Aplica valores iniciais quando o modal abre
	useEffect(() => {
		if (!opened) return;
		if (initial?.disciplina) setDisciplina(initial.disciplina);
		if (initial?.topicoId !== undefined) setTopicoId(initial.topicoId ?? "");
	}, [opened, initial?.disciplina, initial?.topicoId]);

	const handleStart = () => {
		if (!running) {
			if (!startTime) setStartTime(new Date());
			interval.start();
			setRunning(true);
		}
	};

	const handlePause = () => {
		interval.stop();
		setRunning(false);
	};

	const handleSave = async () => {
		interval.stop();
		setRunning(false);

		const disc = disciplina ?? disciplinas[0]?.name;
		if (!disc) return;

		const now = startTime ?? new Date();
		const date = isoDay(now);
		const hh = String(now.getHours()).padStart(2, "0");
		const mm = String(now.getMinutes()).padStart(2, "0");
		const time = `${hh}:${mm}`;
		const filename = sessionFileName(date, time);
		const duracaoMin = Math.max(1, Math.round(seconds / 60));

		const front = [
			"---",
			"tipo: registro",
			`data: ${date}`,
			`inicio: "${time}"`,
			`categoria: ${categoria}`,
			`duracaoMin: ${duracaoMin}`,
			topicoId ? `topicoId: "${topicoId}"` : "",
			`acertos: ${Number(acertos) || 0}`,
			`erros: ${Number(erros) || 0}`,
			material ? `material: "${material}"` : "",
			`paginasLidas: ${Number(paginas) || 0}`,
			"videos: 0",
			`geraRevisao: ${geraRevisao}`,
			"---",
		]
			.filter(Boolean)
			.join("\n");

		const registrosPath = `${root}/${disc}/registros`;
		if (!app.vault.getFolderByPath(registrosPath)) {
			await app.vault.createFolder(registrosPath);
		}
		await app.vault.create(`${registrosPath}/${filename}`, `${front}\n`);

		// Reset
		setSeconds(0);
		setStartTime(null);
		setAcertos(0);
		setErros(0);
		setMaterial("");
		setPaginas(0);
		setTopicoId("");
		onClose();
	};

	const discOptions = disciplinas
		.filter((d) => !d.name.startsWith("_"))
		.map((d) => ({ label: d.name, value: d.name }));

	return (
		<Modal
			centered
			onClose={() => {
				if (!running) {
					setSeconds(0);
					setStartTime(null);
					onClose();
				} else {
					handlePause();
					onClose();
				}
			}}
			opened={opened}
			size="md"
			title={
				<Text fw={700} size="lg">
					Contabilize e registre seus estudos!
				</Text>
			}
		>
			<Stack gap="md">
				{/* Display do cronômetro */}
				<Stack align="center" gap="xs">
					<Title
						order={1}
						style={{
							fontVariantNumeric: "tabular-nums",
							letterSpacing: "-1px",
						}}
					>
						{formatHMS(seconds)}
					</Title>
					<Group gap="xs">
						{!running ? (
							<ActionIcon
								aria-label="iniciar"
								color="mint"
								onClick={handleStart}
								radius="xl"
								size="xl"
								variant="filled"
							>
								<IconPlayerPlay size={22} />
							</ActionIcon>
						) : (
							<ActionIcon
								aria-label="pausar"
								color="gray"
								onClick={handlePause}
								radius="xl"
								size="xl"
								variant="filled"
							>
								<IconPlayerPause size={22} />
							</ActionIcon>
						)}
						<ActionIcon
							aria-label="salvar"
							color="mint"
							disabled={seconds === 0}
							onClick={handleSave}
							radius="xl"
							size="xl"
							variant="light"
						>
							<IconPlayerStop size={22} />
						</ActionIcon>
					</Group>
					{seconds > 0 && (
						<Badge color="mint" variant="light">
							{Math.round(seconds / 60)} min
						</Badge>
					)}
				</Stack>

				{/* Campos do registro */}
				<Select
					data={discOptions}
					label="Disciplina"
					onChange={(v) => setDisciplina(v)}
					placeholder="Selecione..."
					value={disciplina}
				/>
				<Select
					data={CATEGORIAS}
					label="Categoria"
					onChange={(v) => setCategoria((v as Categoria) ?? "TEORIA")}
					value={categoria}
				/>
				<TextInput
					label="ID do Tópico (opcional)"
					onChange={(e) => setTopicoId(e.currentTarget.value)}
					placeholder="ex: 1.1"
					value={topicoId}
				/>
				<Group grow>
					<NumberInput
						label="Acertos"
						min={0}
						onChange={setAcertos}
						value={Number(acertos)}
					/>
					<NumberInput
						label="Erros"
						min={0}
						onChange={setErros}
						value={Number(erros)}
					/>
					<NumberInput
						label="Páginas"
						min={0}
						onChange={setPaginas}
						value={Number(paginas)}
					/>
				</Group>
				<TextInput
					label="Material (opcional)"
					onChange={(e) => setMaterial(e.currentTarget.value)}
					placeholder="ex: Curso X - Aula 12"
					value={material}
				/>

				<Button
					color="mint"
					disabled={seconds === 0}
					fullWidth
					leftSection={<IconPlayerStop size={16} />}
					onClick={handleSave}
					size="md"
					variant="filled"
				>
					Salvar Registro
				</Button>
			</Stack>
		</Modal>
	);
}
