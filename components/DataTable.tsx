import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';

import { Ionicons } from '@expo/vector-icons';

export type DataTableColumn = {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    flex?: number;
    minWidth?: number;
    sortable?: boolean;
};

export type DataTableRow = {
    key: string;
    cells: Record<string, React.ReactNode>;
    onPress?: () => void;
};

type DataTableProps = {
    columns: DataTableColumn[];
    rows: DataTableRow[];
    onHeaderPress?: (key: string) => void;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
    rowPaddingVertical?: number;
};

const DataTable = memo(({ columns, rows, onHeaderPress, sortColumn, sortDirection, rowPaddingVertical }: DataTableProps) => {
    const columnStyles = useMemo(() => {
        return columns.map((column) => ({
            key: column.key,
            style: [
                styles.cell,
                column.align === 'center' && styles.cellCenter,
                column.align === 'right' && styles.cellRight,
                typeof column.flex === 'number' ? { flex: column.flex } : null,
                typeof column.minWidth === 'number' ? { minWidth: column.minWidth } : null
            ]
        }));
    }, [columns]);

    const rowStyle = useMemo(() => [
        styles.row,
        rowPaddingVertical !== undefined ? { paddingVertical: rowPaddingVertical } : null
    ], [rowPaddingVertical]);

    return (
        <View style={styles.table}>
            <View style={styles.headerRow}>
                {columns.map((column, index) => {
                    const isSorted = sortColumn === column.key;
                    const isRightAligned = column.align === 'right';
                    
                    const rightIcon = isSorted
                        ? (
                            <Ionicons
                                name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                                size={12}
                                color={Theme.colors.primary}
                                style={styles.sortIcon}
                            />
                        )
                        : (column.sortable !== false ? <View style={styles.sortIconPlaceholder} /> : null);

                    const content = (
                         <View style={[
                             styles.headerContent,
                             isRightAligned && styles.headerContentRight
                         ]}>
                            {isRightAligned && rightIcon}
                            <Text style={[
                                styles.headerText,
                                isSorted && styles.headerTextActive,
                                isRightAligned && styles.headerTextRight
                            ]}>
                                {column.label}
                            </Text>
                            {!isRightAligned && isSorted && (
                                <Ionicons 
                                    name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                                    size={12} 
                                    color={Theme.colors.primary} 
                                    style={styles.sortIcon}
                                />
                            )}
                        </View>
                    );

                    return (
                        <View key={column.key} style={columnStyles[index].style}>
                            {onHeaderPress && (column.sortable !== false) ? (
                                <Pressable onPress={() => onHeaderPress(column.key)}>
                                    {content}
                                </Pressable>
                            ) : (
                                content
                            )}
                        </View>
                    );
                })}
            </View>
            {rows.map((row) => {
                const combinedRowStyle = row.onPress 
                    ? ({ pressed }: { pressed: boolean }) => [rowStyle, pressed && styles.rowPressed]
                    : rowStyle;

                if (row.onPress) {
                    return (
                        <Pressable
                            key={row.key}
                            onPress={row.onPress}
                            style={combinedRowStyle as any}
                        >
                            {columns.map((column, index) => (
                                <View key={column.key} style={columnStyles[index].style}>
                                    {row.cells[column.key] ?? (
                                        <Text style={styles.placeholder}>—</Text>
                                    )}
                                </View>
                            ))}
                        </Pressable>
                    );
                }
                return (
                    <View key={row.key} style={rowStyle as any}>
                        {columns.map((column, index) => (
                            <View key={column.key} style={columnStyles[index].style}>
                                {row.cells[column.key] ?? (
                                    <Text style={styles.placeholder}>—</Text>
                                )}
                            </View>
                        ))}
                    </View>
                );
            })}
        </View>
    );
});

DataTable.displayName = 'DataTable';

export default DataTable;

const styles = StyleSheet.create({
    table: {
        width: '100%',
        borderRadius: Theme.borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
    },
    headerRow: {
        flexDirection: 'row',
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
        backgroundColor: Theme.colors.glass,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
    },
    rowPressed: {
        backgroundColor: Theme.colors.glassStrong,
    },
    cell: {
        flex: 1,
        justifyContent: 'center',
    },
    cellCenter: {
        alignItems: 'center',
    },
    cellRight: {
        alignItems: 'flex-end',
    },
    headerText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    headerTextActive: {
        color: Theme.colors.primary,
        fontWeight: Theme.typography.weights.bold,
    },
    headerTextRight: {
        textAlign: 'right',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerContentRight: {
        justifyContent: 'flex-end',
    },
    sortIcon: {
        marginTop: -1,
    },
    sortIconPlaceholder: {
        width: 12,
        height: 12,
    },
    placeholder: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
});
