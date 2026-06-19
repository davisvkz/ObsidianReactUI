import { Paper } from "@mantine/core";
import { Outlet } from "react-router";

export default function Layout() {
	return (
		<Paper maw={560} p="md" radius="md" withBorder>
			<Outlet />
		</Paper>
	);
}
