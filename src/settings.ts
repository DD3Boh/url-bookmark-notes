// settings.ts
import { SettingUtils } from "@/libs/setting-utils";
import { Plugin } from "siyuan";

const STORAGE_NAME = "menu-config";

export class SettingsManager {
    private plugin: Plugin;
    private settingUtils: SettingUtils;

    constructor(plugin: Plugin) {
        this.plugin = plugin;

        this.settingUtils = new SettingUtils({
            plugin: this.plugin,
            name: STORAGE_NAME,
        });
    }

    setupSettings() {
        this.settingUtils.addItem({
            key: "includeContent",
            value: false,
            type: "checkbox",
            title: this.plugin.i18n.includeContent,
            description: this.plugin.i18n.includeContentDesc,
            action: {
                callback: () => {
                    let value = !this.settingUtils.get("includeContent");
                    this.settingUtils.set("includeContent", value);
                    console.log(value);
                },
            },
        });

        try {
            this.settingUtils.load();
        } catch (error) {
            console.error("Error loading settings storage, probably empty config json:", error);
        }
    }

    onLayoutReady() {
        this.settingUtils.load();
    }

    getPref = (key: string) => {
        return this.settingUtils.get(key);
    }
}
