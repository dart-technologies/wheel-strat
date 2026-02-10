function buildInsertQuery({
    table,
    columns,
    rows,
    conflictColumns,
    updateColumns,
    allowUpdate
}) {
    const values = [];
    const placeholders = rows.map((row, rowIndex) => {
        const base = rowIndex * columns.length;
        values.push(...columns.map((column) => row[column]));
        const indexes = columns.map((_, colIndex) => `$${base + colIndex + 1}`);
        return `(${indexes.join(', ')})`;
    }).join(', ');

    const conflictClause = allowUpdate
        ? `
        DO UPDATE SET
            ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')},
            updated_at = NOW()
        `
        : 'DO NOTHING';

    const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (${conflictColumns.join(', ')})
        ${conflictClause}
    `;

    return { query, values };
}

module.exports = {
    buildInsertQuery
};
