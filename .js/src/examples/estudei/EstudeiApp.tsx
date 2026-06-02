import { Box, Tabs } from "@mantine/core";
import {
	IconBook,
	IconCalendarStats,
	IconChartBar,
	IconClipboardList,
	IconHome,
	IconRepeat,
} from "@tabler/icons-react";
import { Edital } from "@/examples/estudei/Edital";
import { Estatisticas } from "@/examples/estudei/Estatisticas";
import { Home } from "@/examples/estudei/Home";
import { Planejamento } from "@/examples/estudei/Planejamento";
import { Revisoes } from "@/examples/estudei/Revisoes";
import { Simulados } from "@/examples/estudei/Simulados";

interface EstudeiAppProps {
	root: string;
}

export function EstudeiApp({ root }: EstudeiAppProps) {
	return (
		<Box style={{ fontFamily: "inherit" }}>
			<Tabs defaultValue="home" keepMounted={false}>
				<Tabs.List>
					<Tabs.Tab leftSection={<IconHome size={16} />} value="home">
						Início
					</Tabs.Tab>
					<Tabs.Tab leftSection={<IconBook size={16} />} value="edital">
						Edital
					</Tabs.Tab>
					<Tabs.Tab leftSection={<IconRepeat size={16} />} value="revisoes">
						Revisões
					</Tabs.Tab>
					<Tabs.Tab leftSection={<IconCalendarStats size={16} />} value="planejamento">
						Planejamento
					</Tabs.Tab>
					<Tabs.Tab leftSection={<IconClipboardList size={16} />} value="simulados">
						Simulados
					</Tabs.Tab>
					<Tabs.Tab leftSection={<IconChartBar size={16} />} value="estatisticas">
						Estatísticas
					</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel pt="md" value="home">
					<Home root={root} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="edital">
					<Edital root={root} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="revisoes">
					<Revisoes root={root} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="planejamento">
					<Planejamento root={root} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="simulados">
					<Simulados root={root} />
				</Tabs.Panel>
				<Tabs.Panel pt="md" value="estatisticas">
					<Estatisticas root={root} />
				</Tabs.Panel>
			</Tabs>
		</Box>
	);
}
