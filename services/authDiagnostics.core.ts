type AuthUser = {
    uid?: string;
    isAnonymous?: boolean;
};

type AuthLike = {
    currentUser?: AuthUser | null;
};

type AuthSnapshotDeps = {
    primaryLabel: string;
    secondaryLabel?: string;
    getPrimaryAuth: () => AuthLike | null;
    getSecondaryAuth?: () => AuthLike | null;
    getPrimaryProjectId?: () => string | null;
    getSecondaryProjectId?: () => string | null;
    ensureAuthReady?: () => Promise<void>;
    useEmulator: boolean;
};

export const createAuthDiagnostics = (deps: AuthSnapshotDeps) => {
    let didLogSnapshot = false;

    const logAuthSnapshotOnce = async (context = 'app') => {
        if (didLogSnapshot) return;
        didLogSnapshot = true;

        try {
            await deps.ensureAuthReady?.();
        } catch {
            // Ignore auth readiness errors for diagnostics.
        }

        const payload: Record<string, unknown> = {
            context,
            useEmulator: deps.useEmulator
        };

        const primaryAuth = deps.getPrimaryAuth?.();
        if (primaryAuth) {
            const user = primaryAuth.currentUser;
            payload[`${deps.primaryLabel}Uid`] = user?.uid ?? null;
            payload[`${deps.primaryLabel}IsAnonymous`] = user?.isAnonymous ?? null;
        }

        const primaryProjectId = deps.getPrimaryProjectId?.();
        if (primaryProjectId !== undefined) {
            payload[`${deps.primaryLabel}ProjectId`] = primaryProjectId ?? null;
        }

        if (deps.secondaryLabel && deps.getSecondaryAuth) {
            const secondaryAuth = deps.getSecondaryAuth();
            const user = secondaryAuth?.currentUser;
            payload[`${deps.secondaryLabel}Uid`] = user?.uid ?? null;
            payload[`${deps.secondaryLabel}IsAnonymous`] = user?.isAnonymous ?? null;
        }

        if (deps.secondaryLabel && deps.getSecondaryProjectId) {
            const secondaryProjectId = deps.getSecondaryProjectId();
            payload[`${deps.secondaryLabel}ProjectId`] = secondaryProjectId ?? null;
        }

        // console.log('[auth] snapshot', payload);
    };

    return { logAuthSnapshotOnce };
};
