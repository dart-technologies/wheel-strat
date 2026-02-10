export type CalendarEvent = {
    date: string;
    event: string;
    impact: "high" | "medium" | "low";
    market?: string;
    isOpen?: boolean;
    holiday?: string;
    earlyClose?: boolean;
    symbols?: string[];
    source?: string;
};
