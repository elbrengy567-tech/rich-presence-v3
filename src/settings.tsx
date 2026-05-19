/**
 * Rich Presence Settings
 * Credit: Kite
 * Modern Vencord-inspired settings interface
 */

import { React, ReactNative } from "@vendetta/metro/common";
import { Forms, General } from "@vendetta/ui/components";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import {
    ActivityType,
    ActivityTypeLabels,
    ActivityTypeIcons,
    createDefaultActivity,
    isValidUrl,
    generateProfileId,
    getTimeDisplay,
} from "./utils";

const { View, ScrollView, TouchableOpacity, Text, Image } = ReactNative;
const { FormText, FormInput, FormRow, FormSwitchRow, FormSection, FormDivider } = Forms;
const { Button, Card } = General;

// Typed storage
const typedStorage = storage as typeof storage & {
    selected: string;
    selections: Record<string, Activity>;
    pluginEnabled: boolean;
};

export default function Settings() {
    useProxy(typedStorage);

    // Initialize storage properly
    if (!typedStorage.selected || !typedStorage.selections?.[typedStorage.selected]) {
        typedStorage.selected = "default";
        typedStorage.selections ??= {};
        typedStorage.selections.default ??= createDefaultActivity();
    }

    const settings = useProxy(typedStorage.selections[typedStorage.selected]) as Activity;
    const profiles = Object.keys(typedStorage.selections);
    const currentType = settings.type ?? ActivityType.PLAYING;

    // Profile management functions
    const createProfile = (name: string) => {
        const id = generateProfileId();
        typedStorage.selections[id] = createDefaultActivity({ name });
        typedStorage.selected = id;
        logger.log("[Kite RPC] Created new profile:", name);
    };

    const deleteProfile = (id: string) => {
        if (profiles.length <= 1) return; // Keep at least one
        delete typedStorage.selections[id];
        if (typedStorage.selected === id) {
            typedStorage.selected = Object.keys(typedStorage.selections)[0];
        }
    };

    const duplicateProfile = (id: string) => {
        const original = typedStorage.selections[id];
        if (!original) return;
        const newId = generateProfileId();
        typedStorage.selections[newId] = JSON.parse(JSON.stringify(original));
        typedStorage.selections[newId].name = `${original.name} (Copy)`;
        typedStorage.selected = newId;
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: "var(--background-primary)" }}>
            {/* Plugin Header */}
            <View style={{ 
                padding: 16, 
                backgroundColor: "var(--background-secondary)",
                borderBottomWidth: 1,
                borderBottomColor: "var(--background-modifier-accent)",
            }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                        <FormText style={{ fontSize: 20, fontWeight: "bold", color: "var(--text-normal)" }}>
                            🎮 Rich Presence
                        </FormText>
                        <FormText style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                            Customize your Discord activity status • Credit: Kite
                        </FormText>
                    </View>
                    <TouchableOpacity
                        style={{
                            backgroundColor: "var(--brand-experiment)",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 4,
                        }}
                        onPress={() => {
                            const { default: plugin } = require("../index");
                            plugin.updatePresence();
                        }}
                    >
                        <FormText style={{ color: "white", fontWeight: "600" }}>Update Now</FormText>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ padding: 16 }}>
                {/* Profile Selection */}
                <FormSection title="Profiles">
                    <View style={{ marginBottom: 12 }}>
                        {profiles.map(id => {
                            const profile = typedStorage.selections[id];
                            const isSelected = id === typedStorage.selected;
                            
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        padding: 12,
                                        marginBottom: 8,
                                        backgroundColor: isSelected 
                                            ? "var(--background-modifier-selected)" 
                                            : "var(--background-secondary)",
                                        borderRadius: 8,
                                        borderWidth: isSelected ? 1 : 0,
                                        borderColor: "var(--brand-experiment)",
                                    }}
                                    onPress={() => { typedStorage.selected = id; }}
                                    onLongPress={() => {
                                        // Show profile options
                                        const options = [
                                            { label: "Duplicate", action: () => duplicateProfile(id) },
                                            { label: "Rename", action: () => {
                                                const newName = prompt("Enter new name:", profile.name);
                                                if (newName) profile.name = newName;
                                            }},
                                            { label: "Delete", action: () => deleteProfile(id), destructive: true },
                                        ];
                                        // Simple action sheet alternative
                                        options.forEach(opt => {
                                            if (confirm(`${opt.label} profile "${profile.name}"?`)) {
                                                opt.action();
                                            }
                                        });
                                    }}
                                >
                                    <Text style={{ fontSize: 24, marginRight: 12 }}>
                                        {ActivityTypeIcons[profile.type ?? ActivityType.PLAYING]}
                                    </Text>
                                    <View style={{ flex: 1 }}>
                                        <FormText style={{ fontWeight: "600", color: "var(--text-normal)" }}>
                                            {profile.name}
                                        </FormText>
                                        <FormText style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                            {ActivityTypeLabels[profile.type ?? ActivityType.PLAYING]}
                                            {profile.details ? ` • ${profile.details}` : ""}
                                        </FormText>
                                    </View>
                                    {isSelected && (
                                        <Text style={{ color: "var(--brand-experiment)", fontSize: 20 }}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    
                    <TouchableOpacity
                        style={{
                            backgroundColor: "var(--background-secondary)",
                            padding: 12,
                            borderRadius: 8,
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: "var(--background-modifier-accent)",
                            borderStyle: "dashed",
                        }}
                        onPress={() => {
                            const name = prompt("Profile name:", `Profile ${profiles.length + 1}`);
                            if (name) createProfile(name);
                        }}
                    >
                        <FormText style={{ color: "var(--text-muted)" }}>
                            + Create New Profile
                        </FormText>
                    </TouchableOpacity>
                </FormSection>

                <FormDivider />

                {/* Basic Settings */}
                <FormSection title="🎯 Activity Details">
                    <FormInput
                        title="Status Name"
                        placeholder="Kite Rich Presence"
                        value={settings.name}
                        onChange={(v) => (settings.name = v)}
                        helpText="Shown as the game/application name"
                    />
                    
                    <FormInput
                        title="Application ID"
                        placeholder="1054951789318909972"
                        value={settings.application_id}
                        onChange={(v) => (settings.application_id = v)}
                        keyboardType="numeric"
                        helpText="Custom bot's application ID for rich assets"
                    />

                    {/* Activity Type Selector */}
                    <FormText style={{ marginTop: 12, marginBottom: 8, color: "var(--text-muted)" }}>
                        Activity Type
                    </FormText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {Object.entries(ActivityTypeLabels).map(([type, label]) => {
                            const typeNum = Number(type);
                            const isActive = currentType === typeNum;
                            
                            return (
                                <TouchableOpacity
                                    key={type}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        backgroundColor: isActive 
                                            ? "var(--brand-experiment)" 
                                            : "var(--background-secondary)",
                                        borderWidth: 1,
                                        borderColor: isActive 
                                            ? "var(--brand-experiment)" 
                                            : "var(--background-modifier-accent)",
                                    }}
                                    onPress={() => (settings.type = typeNum)}
                                >
                                    <Text style={{ marginRight: 4 }}>
                                        {ActivityTypeIcons[typeNum]}
                                    </Text>
                                    <FormText style={{ 
                                        color: isActive ? "white" : "var(--text-normal)",
                                        fontWeight: isActive ? "600" : "400",
                                    }}>
                                        {label}
                                    </FormText>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Streaming URL (conditional) */}
                    {currentType === ActivityType.STREAMING && (
                        <FormInput
                            title="📡 Stream URL (Required)"
                            placeholder="https://twitch.tv/yourchannel"
                            value={settings.metadata?.url ?? ""}
                            onChange={(v) => {
                                if (!settings.metadata) settings.metadata = {};
                                settings.metadata.url = v;
                            }}
                            helpText={
                                !isValidUrl(settings.metadata?.url ?? "")
                                    ? "⚠️ Valid URL required for streaming status"
                                    : "✅ URL is valid"
                            }
                        />
                    )}

                    <FormInput
                        title="Details"
                        placeholder="What are you doing?"
                        value={settings.details}
                        onChange={(v) => (settings.details = v)}
                        helpText="First line of your status"
                    />
                    
                    <FormInput
                        title="State"
                        placeholder="Additional info"
                        value={settings.state}
                        onChange={(v) => (settings.state = v)}
                        helpText="Second line of your status"
                    />
                </FormSection>

                <FormDivider />

                {/* Image Assets */}
                <FormSection title="🖼️ Rich Assets">
                    <FormText style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                        Use Discord application asset keys or direct image URLs
                    </FormText>
                    
                    <View style={{ marginBottom: 16 }}>
                        <FormInput
                            title="Large Image"
                            placeholder="mp:external/... or asset_key"
                            value={settings.assets?.large_image}
                            onChange={(v) => (settings.assets.large_image = v)}
                        />
                        <FormInput
                            title="Large Image Tooltip"
                            placeholder="Shown on hover"
                            value={settings.assets?.large_text}
                            onChange={(v) => (settings.assets.large_text = v)}
                            disabled={!settings.assets?.large_image}
                        />
                    </View>

                    <View>
                        <FormInput
                            title="Small Image"
                            placeholder="mp:external/... or asset_key"
                            value={settings.assets?.small_image}
                            onChange={(v) => (settings.assets.small_image = v)}
                        />
                        <FormInput
                            title="Small Image Tooltip"
                            placeholder="Shown on hover"
                            value={settings.assets?.small_text}
                            onChange={(v) => (settings.assets.small_text = v)}
                            disabled={!settings.assets?.small_image}
                        />
                    </View>
                </FormSection>

                <FormDivider />

                {/* Timestamps */}
                <FormSection title="⏱️ Time Display">
                    <FormSwitchRow
                        label="Show elapsed/remaining time"
                        value={settings.timestamps._enabled}
                        onValueChange={(v) => (settings.timestamps._enabled = v)}
                    />
                    
                    {settings.timestamps._enabled && (
                        <>
                            <FormInput
                                title="Start Time (ms)"
                                placeholder="1680000000000"
                                value={String(settings.timestamps?.start ?? "")}
                                onChange={(v) => (settings.timestamps.start = Number(v))}
                                keyboardType="numeric"
                                helpText={settings.timestamps?.start ? getTimeDisplay(settings.timestamps.start) : "Set start timestamp"}
                            />
                            
                            <FormInput
                                title="End Time (ms)"
                                placeholder="Optional countdown"
                                value={String(settings.timestamps?.end ?? "")}
                                onChange={(v) => (settings.timestamps.end = Number(v))}
                                keyboardType="numeric"
                                helpText={settings.timestamps?.end ? getTimeDisplay(settings.timestamps.end) : "Leave empty for elapsed time"}
                            />
                            
                            <FormRow
                                label="Use current time as start"
                                subLabel="Resets the elapsed timer"
                                trailing={FormRow.Arrow}
                                onPress={() => {
                                    settings.timestamps.start = Date.now();
                                    if (settings.timestamps.end && settings.timestamps.end < Date.now()) {
                                        settings.timestamps.end = Date.now() + 3600000; // +1 hour
                                    }
                                }}
                            />
                        </>
                    )}
                </FormSection>

                <FormDivider />

                {/* Action Buttons */}
                <FormSection title="🔗 Action Buttons">
                    <FormText style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        Add clickable buttons to your status (requires URL)
                    </FormText>
                    
                    <View style={{ marginBottom: 16 }}>
                        <FormInput
                            title="Button 1 Label"
                            placeholder="GitHub"
                            value={settings.buttons?.[0]?.label}
                            onChange={(v) => (settings.buttons[0].label = v)}
                        />
                        <FormInput
                            title="Button 1 URL"
                            placeholder="https://github.com/shipwr3ckd"
                            value={settings.buttons?.[0]?.url}
                            onChange={(v) => (settings.buttons[0].url = v)}
                            disabled={!settings.buttons?.[0]?.label}
                            helpText={
                                settings.buttons?.[0]?.label && !isValidUrl(settings.buttons?.[0]?.url ?? "")
                                    ? "❌ Valid URL required"
                                    : settings.buttons?.[0]?.url
                                    ? "✅ URL set"
                                    : "Enter URL for button"
                            }
                        />
                    </View>

                    <View>
                        <FormInput
                            title="Button 2 Label"
                            placeholder="Discord Server"
                            value={settings.buttons?.[1]?.label}
                            onChange={(v) => (settings.buttons[1].label = v)}
                        />
                        <FormInput
                            title="Button 2 URL"
                            placeholder="https://discord.gg/invite"
                            value={settings.buttons?.[1]?.url}
                            onChange={(v) => (settings.buttons[1].url = v)}
                            disabled={!settings.buttons?.[1]?.label}
                            helpText={
                                settings.buttons?.[1]?.label && !isValidUrl(settings.buttons?.[1]?.url ?? "")
                                    ? "❌ Valid URL required"
                                    : settings.buttons?.[1]?.url
                                    ? "✅ URL set"
                                    : "Enter URL for button"
                            }
                        />
                    </View>
                </FormSection>

                {/* Preview */}
                <FormSection title="👁️ Preview">
                    <View style={{
                        padding: 16,
                        backgroundColor: "var(--background-secondary)",
                        borderRadius: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: "var(--brand-experiment)",
                    }}>
                        <FormText style={{ fontWeight: "600", color: "var(--text-normal)" }}>
                            {settings.name || "Rich Presence"}
                        </FormText>
                        <FormText style={{ color: "var(--text-muted)", marginTop: 4 }}>
                            {ActivityTypeLabels[currentType]} {settings.details || "..."}
                        </FormText>
                        {settings.state && (
                            <FormText style={{ color: "var(--text-muted)" }}>
                                {settings.state}
                            </FormText>
                        )}
                        {settings.timestamps._enabled && (
                            <FormText style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                                ⏱️ {settings.timestamps.start ? getTimeDisplay(settings.timestamps.start) : "Now"} 
                                {settings.timestamps.end ? ` → ${getTimeDisplay(settings.timestamps.end)}` : " elapsed"}
                            </FormText>
                        )}
                        {settings.buttons?.some(b => b.label && b.url) && (
                            <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                                {settings.buttons.map((btn, i) => 
                                    btn.label && btn.url && (
                                        <View key={i} style={{
                                            backgroundColor: "var(--background-modifier-accent)",
                                            paddingHorizontal: 12,
                                            paddingVertical: 4,
                                            borderRadius: 4,
                                        }}>
                                            <FormText style={{ fontSize: 12 }}>{btn.label}</FormText>
                                        </View>
                                    )
                                )}
                            </View>
                        )}
                    </View>
                </FormSection>
            </View>
        </ScrollView>
    );
}