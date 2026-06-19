// path

// fs-routes: builds RouteObject[] from require.context
export { createFsRoutes } from "@/lib/fsRoutes";
// opinionated Mantine render helper
export {
	type MantineRenderOptions,
	mantineRender,
} from "@/lib/mantine";
export { containingFolderKeys, folderFilesKey, parentOf } from "@/lib/path";
// reactive cache
export { ReactiveCache } from "@/lib/reactiveCache";
// generic render (shadow-DOM, no UI lib dependency)
export { AppContext, HostContext, mountShadowReact } from "@/lib/render";
// persistent router (MemoryRouter that survives Dataview re-evals)
export {
	PersistentRouter,
	type PersistentRouterProps,
} from "@/lib/router";
// snapshot
export {
	isFolder,
	type MdSnapshot,
	type Subfolder,
	stripFrontmatter,
} from "@/lib/snapshot";
// store — reactive reads
// store — mutations
export {
	ensureFolder,
	getFolderFiles,
	getSnapshot,
	getSubfolders,
	subscribeFile,
	subscribeFolderFiles,
	subscribeSubfolders,
	trashPath,
	updateBody,
	updateFrontmatter,
} from "@/lib/store";
// React hooks
export {
	type UseFolderFiles,
	type UseMarkdownFile,
	type UseSubfolders,
	useApp,
	useFolderFiles,
	useMarkdownFile,
	useSubfolders,
} from "@/lib/useMarkdownFile";
