import { ReactNative, FluxDispatcher } from '@revenge-mod/metro/common';
import { findByProps } from '@revenge-mod/metro';
import { storage } from '@revenge-mod/plugin';
import { logger } from '@revenge-mod/revenge/src/lib';

const AssetManager = findByProps("getAssetIds", "fetchAssetIds");
const LOCAL_ACTIVITY_UPDATE = "LOCAL_ACTIVITY_UPDATE";
const PLUGIN_PID = Math.floor(Math.random() * 10000) + 1000;

const typedStorage = storage as typeof storage & {
    selected: string;
    selections: Record<string, Activity>;
    pluginEnabled: boolean;
};

function createDefaultActivity(): Activity {
    return {
        name: "Kite Rich Presence",
        application_id: "1054951789318909972",
        flags: 1,
        type: 0,
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
        buttons: [{ label: "", url: "" }, { label: "", url: "" }],
        metadata: {},
    };
}

// Initialize storage
if (!typedStorage.selected || !typedStorage.selections?.[typedStorage.selected]) {
    typedStorage.selected = "default";
    typedStorage.selections ??= {};
    typedStorage.selections.default ??= createDefaultActivity();
}
typedStorage.pluginEnabled = true;

function cloneAndFilter<T extends Record<string, any>>(obj: T): T {
    const filter = (key: string, value: any): any => {
        if (typeof key === "string" && key.startsWith("_")) return undefined;
        if (value === undefined || value === null || value === "") return undefined;
        if (Array.isArray(value) && value.length === 0) return undefined;
        if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return undefined;
        return value;
    };
    return JSON.parse(JSON.stringify(obj, filter));
}

function isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

async function resolveAssets(activity: Activity): Promise<void> {
    if (!activity.assets) return;
    
    try {
        const assetsToResolve: string[] = [];
        const assetTypes: string[] = [];
        
        if (activity.assets.large_image) {
            if (activity.assets.large_image.startsWith("http")) {
                activity.assets.large_image = await AssetManager.uploadAsset(activity.assets.large_image, activity.application_id);
            } else {
                assetsToResolve.push(activity.assets.large_image);
                assetTypes.push("large");
            }
        }
        
        if (activity.assets.small_image) {
            if (activity.assets.small_image.startsWith("http")) {
                activity.assets.small_image = await AssetManager.uploadAsset(activity.assets.small_image, activity.application_id);
            } else {
                assetsToResolve.push(activity.assets.small_image);
                assetTypes.push("small");
            }
        }
        
        if (assetsToResolve.length > 0) {
            const assetIds = await AssetManager.fetchAssetIds(activity.application_id, assetsToResolve);
            assetsToResolve.forEach((_, index) => {
                const assetId = assetIds[index];
                if (assetId) {
                    if (assetTypes[index] === "large") activity.assets!.large_image = assetId;
                    else activity.assets!.small_image = assetId;
                }
            });
        }
    } catch (e) {
        logger.error("[Kite RPC] Failed to resolve assets:", e);
    }
}

function processButtons(activity: Activity): void {
    if (!activity.buttons || !Array.isArray(activity.buttons)) {
        delete activity.buttons;
        return;
    }
    
    const validButtons = activity.buttons.filter(btn => btn && btn.label?.trim() && isValidUrl(btn.url));
    
    if (validButtons.length === 0) {
        delete activity.buttons;
        delete activity.metadata?.button_urls;
        return;
    }
    
    activity.metadata = activity.metadata || {};
    activity.metadata.button_urls = validButtons.map(btn => btn.url);
    (activity as any).buttons = validButtons.map(btn => btn.label);
}

function processTimestamps(activity: Activity): void {
    const { timestamps } = activity;
    if (!timestamps || !timestamps._enabled) {
        delete activity.timestamps;
        return;
    }
    
    const clean: any = {};
    if (timestamps.start && typeof timestamps.start === "number") clean.start = timestamps.start;
    if (timestamps.end && typeof timestamps.end === "number" && timestamps.end > 0) clean.end = timestamps.end;
    
    if (Object.keys(clean).length === 0) delete activity.timestamps;
    else activity.timestamps = clean;
}

function processStreaming(activity: Activity): void {
    if (activity.type !== 1) {
        delete activity.metadata?.url;
        return;
    }
    if (!activity.metadata?.url || !isValidUrl(activity.metadata.url)) {
        activity.type = 0;
        delete activity.metadata?.url;
    }
}

async function sendActivity(activity: Activity | null): Promise<void> {
    if (!activity) {
        FluxDispatcher.dispatch({
            type: LOCAL_ACTIVITY_UPDATE,
            activity: null,
            pid: PLUGIN_PID,
            socketId: "KiteRPC",
        });
        return;
    }
    
    const prepared = cloneAndFilter(activity);
    processTimestamps(prepared);
    processStreaming(prepared);
    processButtons(prepared);
    await resolveAssets(prepared);
    
    FluxDispatcher.dispatch({
        type: LOCAL_ACTIVITY_UPDATE,
        activity: {
            ...prepared,
            name: prepared.name || "Kite Rich Presence",
            type: prepared.type ?? 0,
            flags: prepared.flags ?? 1,
        },
        pid: PLUGIN_PID,
        socketId: "KiteRPC",
    });
}

export default {
    onLoad() {
        const current = typedStorage.selections?.[typedStorage.selected];
        if (current) sendActivity(current);
    },
    onUnload() {
        sendActivity(null);
    },
    settings: require("./settings").default,
};
