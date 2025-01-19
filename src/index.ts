import {
    Plugin,
    getFrontend,
    getBackend,
    IModel,
} from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";
const STORAGE_NAME = "menu-config";

export default class PluginSample extends Plugin {
    customTab: () => IModel;
    private isMobile: boolean;
    private settingUtils: SettingUtils;

    async onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

        console.log("loading plugin-sample", this.i18n);

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        this.addIcons(``);

        this.settingUtils = new SettingUtils({
            plugin: this, name: STORAGE_NAME
        });

        try {
            this.settingUtils.load();
        } catch (error) {
            console.error("Error loading settings storage, probably empty config json:", error);
        }
    }

    onLayoutReady() {
        // this.loadData(STORAGE_NAME);
        this.settingUtils.load();
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
    }

    async onunload() {
        console.log("onunload");
    }

    uninstall() {
        console.log("uninstall");
    }
}
