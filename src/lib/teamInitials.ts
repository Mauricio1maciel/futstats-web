// Iniciais do time para o escudo genérico: as duas primeiras palavras que importam, sem as siglas do
// tipo de clube e as preposições. "Guarany de Bagé" -> "GB"; "Operário MS" -> "OM"; "Bahia" -> "BA"
const IGNORED = new Set(['ec', 'fc', 'sc', 'ac', 'de', 'do', 'da', 'dos', 'das', 'e']);

export function teamInitials(name: string | null | undefined) {
  const words = String(name || '')
    .trim()
    .split(/[\s-]+/)
    .map(word => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(word => word && !IGNORED.has(word.toLowerCase()));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
