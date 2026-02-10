export const snapshotToList = <T>(
    snapshot: any,
    mapper?: (docSnap: any) => T
): T[] => {
    const list: T[] = [];
    snapshot.forEach((docSnap: any) => {
        list.push(mapper ? mapper(docSnap) : (docSnap.data() as T));
    });
    return list;
};

export const snapshotToListWithId = <T extends Record<string, unknown>>(
    snapshot: any,
    mapper?: (docSnap: any) => T
): T[] => {
    const list: T[] = [];
    snapshot.forEach((docSnap: any) => {
        if (mapper) {
            list.push(mapper(docSnap));
            return;
        }
        list.push({ ...(docSnap.data() as T), id: docSnap.id });
    });
    return list;
};

export const docExists = (docSnap: any): boolean => {
    if (!docSnap) return false;
    const exists = typeof docSnap.exists === 'function'
        ? docSnap.exists()
        : docSnap.exists;
    return Boolean(exists);
};
