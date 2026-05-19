/**
 * Rich Presence Plugin for Revenge
 * Credit: Kite
 * A complete rework inspired by Vencord's Rich Presence plugin
 */

import { FluxDispatcher } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import Settings from "./Settings";
import {
    cloneAndFilter,
    ActivityType,
    createDefaultActivity,
    isValidUrl,
    migrateStorage,
} from "./utils";

// Discord's Local Activity constants
const LOCAL_ACTIVITY_UPDATE = "LOCAL_ACTIVITY_UPDATE";
const PLUGIN_PID = Math.floor(Math.random() * 10000) + 1000;

// Get Discord's internal asset manager
const AssetManager = findByProps("getAssetIds", "fetchAssetIds");

// Plugin state
interface PluginState {
    selected: string;
    selections: Record<string, Activity>;
    pluginEnabled: boolean;
}

let currentActivity: Activity | null = null;
let updateInterval: NodeJS.Timeout | null = null;
let pluginStartTime: number = Date.now();

// Type the storage
const pluginStorage = migrateStorage(storage) as unknown as PluginState;

/**
 * Resolve image assets - handles both URLs and Discord asset keys
 */
async function resolveAssets(activity: Activity): Promise<void> {
    if (!activity.assets) return;

    try {
        const assetsToResolve: string[] = [];
        const assetTypes: string[] = [];

        // Check large image
        if (activity.assets.large_image) {
            if (activity.assets.large_image.startsWith("http") || activity.assets.large_image.startsWith("mp:")) {
                activity.assets.large_image = await AssetManager.uploadAsset(activity.assets.large_image, activity.application_id);
            } else {
                assetsToResolve.push(activity.assets.large_image);
                assetTypes.push("large");
            }
        }

        // Check small image
        if (activity.assets.small_image) {
            if (activity.assets.small_image.startsWith("http") || activity.assets.small_image.startsWith("mp:")) {
                activity.assets.small_image = await AssetManager.uploadAsset(activity.assets.small_image, activity.application_id);
            } else {
                assetsToResolve.push(activity.assets.small_image);
                assetTypes.push("small");
            }
        }

        // Resolve Discord asset keys
        if (assetsToResolve.length > 0) {
            const assetIds = await AssetManager.fetchAssetIds(activity.application_id, assetsToResolve);
            
            assetsToResolve.forEach((_, index) => {
                const assetId = assetIds[index];
                if (assetId) {
                    if (assetTypes[index] === "large") {
                        activity.assets!.large_image = assetId;
                    } else {
                        activity.assets!.small_image = assetId;
                    }
                }
            });
        }
    } catch (error) {
        logger.error("[Kite RPC] Failed to resolve assets:", error);
    }
}

/**
 * Process buttons into the format Discord expects
 */
function processButtons(activity: Activity): void {
    if (!activity.buttons || !Array.isArray(activity.buttons)) {
        delete activity.buttons;
        return;
    }

    const validButtons = activity.buttons.filter(btn => {
        return btn && btn.label && btn.label.trim() && isValidUrl(btn.url);
    });

    if (validButtons.length === 0) {
        delete activity.buttons;
        delete activity.metadata?.button_urls;
        return;
    }

    // Discord expects buttons as array of strings and URLs in metadata
    activity.metadata = activity.metadata || {};
    activity.metadata.button_urls = validButtons.map(btn => btn.url);
    (activity as any).buttons = validButtons.map(btn => btn.label);
}

/**
 * Process timestamps into Discord's expected format
 */
function processTimestamps(activity: Activity): void {
    const { timestamps } = activity;
    
    if (!timestamps || !timestamps._enabled) {
        delete activity.timestamps;
        return;
    }

    const cleanTimestamps: any = {};

    if (timestamps.start && typeof timestamps.start === "number") {
        cleanTimestamps.start = timestamps.start;
    }

    if (timestamps.end && typeof timestamps.end === "number" && timestamps.end > 0) {
        cleanTimestamps.end = timestamps.end;
    }

    if (Object.keys(cleanTimestamps).length === 0) {
        delete activity.timestamps;
    } else {
        activity.timestamps = cleanTimestamps;
    }
}

/**
 * Handle streaming activity type (requires URL)
 */
function processStreaming(activity: Activity): void {
    if (activity.type !== ActivityType.STREAMING) {
        delete activity.metadata?.url;
        return;
    }

    // Streaming type requires a URL
    if (!activity.metadata?.url || !isValidUrl(activity.metadata.url)) {
        logger.warn("[Kite RPC] Streaming activity requires a valid URL");
        // Fall back to playing if no URL
        activity.type = ActivityType.PLAYING;
        delete activity.metadata?.url;
    }
}

/**
 * Send the activity to Discord via Flux
 */
async function sendActivity(activity: Activity | null): Promise<void> {
    if (!activity) {
        // Clear activity
        FluxDispatcher.dispatch({
            type: LOCAL_ACTIVITY_UPDATE,
            activity: null,
            pid: PLUGIN_PID,
            socketId: "KiteRPC",
        });
        logger.log("[Kite RPC] Cleared activity");
        return;
    }

    // Clone and prepare activity
    const preparedActivity = cloneAndFilter(activity, true);
    
    // Process different activity parts
    processTimestamps(preparedActivity);
    processStreaming(preparedActivity);
    processButtons(preparedActivity);
    
    // Resolve image assets
    await resolveAssets(preparedActivity);

    // Send the activity
    FluxDispatcher.dispatch({
        type: LOCAL_ACTIVITY_UPDATE,
        activity: {
            ...preparedActivity,
            // Ensure required fields
            name: preparedActivity.name || "Kite Rich Presence",
            type: preparedActivity.type ?? ActivityType.PLAYING,
            flags: preparedActivity.flags ?? 1,
        },
        pid: PLUGIN_PID,
        socketId: "KiteRPC",
    });

    currentActivity = preparedActivity;
    logger.log("[Kite RPC] Activity updated:", preparedActivity.name);
}

/**
 * Auto-refresh timestamps
 */
function startAutoRefresh(): void {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
        const current = pluginStorage.selections?.[pluginStorage.selected];
        if (current && pluginStorage.pluginEnabled) {
            // Update start timestamp if using "time since plugin start"
            if (current.timestamps?._enabled && current.timestamps.start === 0) {
                current.timestamps.start = pluginStartTime;
            }
            sendActivity(current);
        }
    }, 15000); // Refresh every 15 seconds
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh(): void {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

export default {
    onLoad() {
        logger.log("[Kite RPC] Plugin loaded - Credit: Kite");
        
        // Ensure storage is initialized
        if (!pluginStorage.selections) {
            pluginStorage.selections = { default: createDefaultActivity() };
        }
        
        if (!pluginStorage.selected) {
            pluginStorage.selected = "default";
        }

        pluginStorage.pluginEnabled = true;

        // Start the presence
        const current = pluginStorage.selections[pluginStorage.selected];
        if (current) {
            sendActivity(current).catch(e => 
                logger.error("[Kite RPC] Failed to send initial activity:", e)
            );
        }

        startAutoRefresh();
    },

    onUnload() {
        logger.log("[Kite RPC] Plugin unloaded");
        stopAutoRefresh();
        sendActivity(null);
        currentActivity = null;
        pluginStorage.pluginEnabled = false;
    },

    // Expose for manual updates
    updatePresence: async (activity?: Activity) => {
        const toUpdate = activity || pluginStorage.selections[pluginStorage.selected];
        if (toUpdate) {
            await sendActivity(toUpdate);
        }
    },

    // Get current activity
    getCurrentActivity: () => currentActivity,

    settings: Settings,
};