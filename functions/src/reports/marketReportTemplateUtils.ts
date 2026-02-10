/**
 * Generate SVG Sparkline
 */
export const generateSparkline = (
    data: number[],
    width = 100,
    height = 30,
    color = "#a78bfa"
): string => {
    if (!data || data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(" ");

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="${color}" stroke-width="2">
        <polyline points="${points}" />
    </svg>`;
};
