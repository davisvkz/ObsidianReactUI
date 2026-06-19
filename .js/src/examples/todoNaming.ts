/**
 * Sanitizes a user-entered name to be used as a vault folder name.
 * Invalid path characters (`\/:*?"<>|`) are replaced with `-`.
 * An empty string or one consisting only of spaces results in `"untitled"`.
 */
export function sanitizeFolderName(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|]/g, "-") || "untitled";
}
