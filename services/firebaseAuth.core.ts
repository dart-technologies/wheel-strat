type AuthLike = {
    currentUser?: unknown;
};

type AuthHelpersDeps = {
    label: string;
    getAuth: () => AuthLike;
    signInAnonymously?: (auth: AuthLike) => Promise<unknown>;
    onAuthStateChanged: (auth: AuthLike, handler: (user: unknown) => void) => () => void;
};

export const createAuthHelpers = (deps: AuthHelpersDeps) => {
    let anonAuthPromise: Promise<void> | null = null;
    let authReadyPromise: Promise<void> | null = null;

    const ensureAnonymousAuth = () => {
        const auth = deps.getAuth();
        if (!auth) return;
        if (auth.currentUser) return;
        if (anonAuthPromise) return;
        if (typeof deps.signInAnonymously !== 'function') {
            if (process.env.NODE_ENV !== 'test') {
                console.warn(`[firebase] signInAnonymously unavailable; skipping anonymous ${deps.label} auth.`);
            }
            return;
        }
        anonAuthPromise = deps.signInAnonymously(auth)
            .then(() => {
                console.log(`[firebase] Anonymous ${deps.label} auth ready.`);
            })
            .catch((error) => {
                console.warn(`[firebase] Anonymous ${deps.label} auth failed:`, error);
            })
            .finally(() => {
                anonAuthPromise = null;
            });
    };

    const ensureAuthReady = () => {
        if (authReadyPromise) return authReadyPromise;

        ensureAnonymousAuth();

        authReadyPromise = new Promise((resolve) => {
            const auth = deps.getAuth();
            if (auth?.currentUser) {
                resolve();
                return;
            }

            const unsubscribe = deps.onAuthStateChanged(auth, (user) => {
                if (user) {
                    unsubscribe();
                    resolve();
                }
            });

            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 4000);
        });

        return authReadyPromise;
    };

    return { ensureAnonymousAuth, ensureAuthReady };
};
