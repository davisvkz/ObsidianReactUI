// path
export { containingFolderKeys, folderFilesKey, parentOf } from "@/lib/path";

// reactive cache
export { ReactiveCache } from "@/lib/reactiveCache";

// snapshot
export {
	isFolder,
	type MdSnapshot,
	stripFrontmatter,
	type Subfolder,
} from "@/lib/snapshot";

// store — leitura reativa
export {
	getFolderFiles,
	getSnapshot,
	getSubfolders,
	subscribeFile,
	subscribeFolderFiles,
	subscribeSubfolders,
} from "@/lib/store";

// store — mutações
export {
	ensureFolder,
	trashPath,
	updateBody,
	updateFrontmatter,
} from "@/lib/store";

// hooks React
export {
	useApp,
	useFolderFiles,
	useMarkdownFile,
	useSubfolders,
	type UseFolderFiles,
	type UseMarkdownFile,
	type UseSubfolders,
} from "@/lib/useMarkdownFile";

// render genérico (shadow-DOM, sem dependência de UI lib)
export { AppContext, HostContext, mountShadowReact } from "@/lib/render";

// render Mantine (opinionado)
export {
	mantineRender,
	type MantineRenderOptions,
} from "@/lib/mantine";
