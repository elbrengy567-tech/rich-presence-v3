/**
 * Rich Presence Plugin Utilities
 * Credit: Kite
 * Inspired by Vencord's RPC implementation
 */

// Activity type constants matching Discord's RPC protocol
export const ActivityType = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    COMPETING: 5,
} as const;

export const ActivityTypeLabels: Record<number, string> = {
    [ActivityType.PLAYING]: "Playing",
    [ActivityType.STREAMING]: "Streaming",
    [ActivityType.LISTENING]: "Listening",
    [ActivityType.WATCHING]: "Watching",
    [ActivityType.COMPETING]: "Competing",
};

export const ActivityTypeIcons: Record<number, string> = {
    [ActivityType.PLAYING]: "🎮",
    [ActivityType.STREAMING]: "📡",
    [ActivityType.LISTENING]: "🎵",
    [ActivityType.WATCHING]: "📺",
    [ActivityType.COMPETING]: "🏆",
};

// Deep clone utility with filtering
export function cloneAndFilter<T extends Record<string, any>>(obj: T, preserveTimestamps = false): T {
    const seen = new WeakSet();
    
    const filter = (key: string, value: any): any => {
        // Skip internal/private properties
        if (typeof key === "string" && key.startsWith("_")) {
            return undefined;
        }
        
        // Handle circular references
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return undefined;
            seen.add(value);
        }
        
        // Filter falsy values except valid ones
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value === "number" && isNaN(value)) return undefined;
        if (Array.isArray(value) && value.length === 0) return undefined;
        if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return undefined;
        
        return value;
    };
    
    return JSON.parse(JSON.stringify(obj, filter));
}

// Validate URL format
export function isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

// Generate profile ID
export function generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Merge activities with defaults
export function createDefaultActivity(overrides: Partial<Activity> = {}): Activity {
    return {
        name: "Kite Rich Presence",
        application_id: "1054951789318909972",
        flags: 1, // INSTANCE flag by default
        type: ActivityType.PLAYING,
        details: "",
        state: "",
        timestamps: {
            _enabled: false,
            start: Date.now(),
        },
        assets: {
            large_image: "",
            large_text: "",
            small_image: "",
            small_text: "",
        },
        buttons: [
            { label: "", url: "" },
            { label: "", url: "" },
        ],
        metadata: {},
        ...overrides,
    };
}

// Asset URL validation
export function isAssetUrl(value: string): boolean {
    if (!value) return false;
    // Check if it's a URL
    if (value.startsWith("http://") || value.startsWith("https://")) return true;
    // Check if it's a Discord CDN URL
    if (value.startsWith("mp:")) return true;
    // It's likely an asset key
    return false;
}

// Timestamp helper
export function getTimeDisplay(timestamp: number): string {
    if (!timestamp) return "Not set";
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Storage migration helper
export function migrateStorage(oldStorage: any): any {
    // Handle migration from old format if needed
    if (typeof oldStorage !== "object" || !oldStorage) {
        return {
            selected: "default",
            selections: {
                default: createDefaultActivity(),
            },
            pluginEnabled: true,
        };
    }
    
    // Ensure all profiles have required fields
    if (oldStorage.selections) {
        Object.keys(oldStorage.selections).forEach(key => {
            oldStorage.selections[key] = createDefaultActivity(oldStorage.selections[key]);
        });
    }
    
    return oldStorage;
}