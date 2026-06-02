/**
 * Sanitiza o nome inserido pelo usuário para ser usado como nome de pasta no vault.
 * Caracteres inválidos em paths de sistema (`\/:*?"<>|`) são trocados por `-`.
 * Nome vazio ou só espaços resulta em `"untitled"`.
 */
export function sanitizeFolderName(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|]/g, "-") || "untitled";
}
