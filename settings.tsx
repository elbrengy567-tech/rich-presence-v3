import { React, ReactNative } from '@revenge-mod/metro/common';
import { Forms } from '@revenge-mod/ui/components';
import { useProxy } from '@revenge-mod/storage';
import { storage } from '@revenge-mod/plugin';
import { logger } from '@revenge-mod/revenge/src/lib';

const { View, ScrollView, TouchableOpacity, Text } = ReactNative;
const { FormText, FormInput, FormRow, FormSwitchRow, FormSection, FormDivider } = Forms;

const ActivityTypes = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    COMPETING: 5,
};

const ActivityTypeLabels: Record<number, string> = {
    0: "Playing",
    1: "Streaming",
    2: "Listening",
    3: "Watching",
    5: "Competing",
};

const typedStorage = storage as typeof storage & {
    selected: string;
    selections: Record<string, Activity>;
};

export default function Settings() {
    useProxy(typedStorage);
    
    if (!typedStorage.selected || !typedStorage.selections?.[typedStorage.selected]) {
        typedStorage.selected = "default";
        typedStorage.selections ??= {};
        typedStorage.selections.default = {
            name: "Kite Rich Presence",
            application_id: "1054951789318909972",
            flags: 1,
            type: 0,
            details: "",
            state: "",
            timestamps: { _enabled: false, start: Date.now() },
            assets: { large_image: "", large_text: "", small_image: "", small_text: "" },
            buttons: [{ label: "", url: "" }, { label: "", url: "" }],
            metadata: {},
        };
    }
    
    const settings = useProxy(typedStorage.selections[typedStorage.selected]) as Activity;
    const currentType = settings.type ?? 0;
    
    return (
        <ScrollView>
            <View style={{ padding: 16 }}>
                <FormText style={{ fontSize: 20, fontWeight: "bold", marginBottom: 8 }}>
                    Rich Presence • Credit: kite
                </FormText>
                
                <TouchableOpacity
                    style={{ backgroundColor: "#5865F2", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 16 }}
                    onPress={() => {
                        const plugin = require("../index").default;
                        plugin.onUnload();
                        plugin.onLoad();
                    }}
                >
                    <FormText style={{ color: "white", fontWeight: "600" }}>Update Presence</FormText>
                </TouchableOpacity>
                
                <FormSection title="Basic">
                    <FormInput title="Application Name" placeholder="Kite Rich Presence" value={settings.name} onChange={(v: string) => settings.name = v} />
                    <FormInput title="Application ID" placeholder="1054951789318909972" value={settings.application_id} onChange={(v: string) => settings.application_id = v} keyboardType="numeric" />
                    
                    <FormText style={{ marginTop: 8, marginBottom: 8 }}>Activity Type</FormText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {Object.entries(ActivityTypeLabels).map(([type, label]) => (
                            <TouchableOpacity
                                key={type}
                                style={{
                                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                                    backgroundColor: currentType === Number(type) ? "#5865F2" : "var(--background-secondary)",
                                }}
                                onPress={() => settings.type = Number(type)}
                            >
                                <FormText style={{ color: currentType === Number(type) ? "white" : "var(--text-normal)" }}>
                                    {label}
                                </FormText>
                            </TouchableOpacity>
                        ))}
                    </View>
                    
                    {currentType === ActivityTypes.STREAMING && (
                        <FormInput
                            title="Stream URL (Required)"
                            placeholder="https://twitch.tv/channel"
                            value={settings.metadata?.url ?? ""}
                            onChange={(v: string) => { if (!settings.metadata) settings.metadata = {}; settings.metadata.url = v; }}
                        />
                    )}
                    
                    <FormInput title="Details" placeholder="What are you doing?" value={settings.details} onChange={(v: string) => settings.details = v} />
                    <FormInput title="State" placeholder="Additional info" value={settings.state} onChange={(v: string) => settings.state = v} />
                </FormSection>
                
                <FormDivider />
                
                <FormSection title="Images">
                    <FormInput title="Large Image" placeholder="asset_key or URL" value={settings.assets?.large_image} onChange={(v: string) => settings.assets.large_image = v} />
                    <FormInput title="Large Image Text" placeholder="Tooltip" value={settings.assets?.large_text} onChange={(v: string) => settings.assets.large_text = v} disabled={!settings.assets?.large_image} />
                    <FormInput title="Small Image" placeholder="asset_key or URL" value={settings.assets?.small_image} onChange={(v: string) => settings.assets.small_image = v} />
                    <FormInput title="Small Image Text" placeholder="Tooltip" value={settings.assets?.small_text} onChange={(v: string) => settings.assets.small_text = v} disabled={!settings.assets?.small_image} />
                </FormSection>
                
                <FormDivider />
                
                <FormSection title="Timestamps">
                    <FormSwitchRow label="Enable Timestamps" value={settings.timestamps._enabled} onValueChange={(v: boolean) => settings.timestamps._enabled = v} />
                    {settings.timestamps._enabled && (
                        <>
                            <FormInput title="Start (ms)" placeholder="1680000000000" value={String(settings.timestamps?.start ?? "")} onChange={(v: string) => settings.timestamps.start = Number(v)} keyboardType="numeric" />
                            <FormInput title="End (ms)" placeholder="Optional" value={String(settings.timestamps?.end ?? "")} onChange={(v: string) => settings.timestamps.end = Number(v)} keyboardType="numeric" />
                            <FormRow label="Use current time" trailing={FormRow.Arrow} onPress={() => settings.timestamps.start = Date.now()} />
                        </>
                    )}
                </FormSection>
                
                <FormDivider />
                
                <FormSection title="Buttons">
                    <FormInput title="Button 1 Label" placeholder="Label" value={settings.buttons?.[0]?.label} onChange={(v: string) => settings.buttons[0].label = v} />
                    <FormInput title="Button 1 URL" placeholder="https://..." value={settings.buttons?.[0]?.url} onChange={(v: string) => settings.buttons[0].url = v} disabled={!settings.buttons?.[0]?.label} />
                    <FormInput title="Button 2 Label" placeholder="Label" value={settings.buttons?.[1]?.label} onChange={(v: string) => settings.buttons[1].label = v} />
                    <FormInput title="Button 2 URL" placeholder="https://..." value={settings.buttons?.[1]?.url} onChange={(v: string) => settings.buttons[1].url = v} disabled={!settings.buttons?.[1]?.label} />
                </FormSection>
            </View>
        </ScrollView>
    );
}
