export const trimEmptyLines = (input: string) => {
    return input
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');
}
