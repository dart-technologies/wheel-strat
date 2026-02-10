export function isFunctionsEmulator(): boolean {
    return process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_EMULATOR_HUB);
}
