import { Card, Text } from "@mantine/core";
import type { ReactNode } from "react";

interface StatCardProps {
	label: string;
	minW?: number;
	sub?: ReactNode;
	value: ReactNode;
}

/** Cartão de estatística genérico: label em cima, valor grande, sub opcional abaixo. */
export function StatCard({ label, value, sub, minW = 160 }: StatCardProps) {
	return (
		<Card padding="md" radius="md" style={{ minWidth: minW }} withBorder>
			<Text
				c="dimmed"
				fw={600}
				size="xs"
				style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
			>
				{label}
			</Text>
			<Text fw={700} mt={4} size="xl">
				{value}
			</Text>
			{sub && (
				<Text c="dimmed" mt={2} size="xs">
					{sub}
				</Text>
			)}
		</Card>
	);
}
