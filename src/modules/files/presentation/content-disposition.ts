export function createAttachmentDisposition(originalName: string): string {
  const safeName = [...originalName]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 ||
        code === 127 ||
        character === '"' ||
        character === '\\'
        ? '_'
        : character;
    })
    .join('')
    .slice(0, 255);
  const asciiFallback = safeName.replace(/[^\x20-\x7e]/g, '_') || 'download';
  const encodedName = encodeURIComponent(safeName || 'download').replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}
