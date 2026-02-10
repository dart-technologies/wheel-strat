export type ServiceStatus = {
    status: "ok" | "error" | "warning";
    message?: string;
    details?: any;
};
