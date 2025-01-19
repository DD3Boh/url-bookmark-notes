import {
    Plugin,
    getFrontend,
    getBackend,
    IModel,
    Dialog,
    Protyle,
    showMessage,
} from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";
import { createDocWithMd, forwardProxy, getHPathByPath } from "./api";
const STORAGE_NAME = "menu-config";

function getFileName(title: string): string {
    const sanitized = title
        .replace(/[\/\\?%*:|"<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const maxLength = 127;
    const truncated = sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;

    return `${truncated}`;
}

const getTitle = async (href) => {
    console.log(href);

    let title = null;
    if (!href.startsWith("http")) href = "http://" + href;

    let data = await forwardProxy(
        href, 'GET', null,
        [{ 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76" }],
        5000, 'text/html'
    );
    if (!data || (data.status / 100) !== 2) return null;

    const doc = new DOMParser().parseFromString(data?.body, "text/html");
    const charset = doc.characterSet;

    if (charset.toLowerCase() === "utf-8") title = doc.title;

    return title;
}

export default class UrlNotesPlugin extends Plugin {
    customTab: () => IModel;
    private isMobile: boolean;
    private settingUtils: SettingUtils;

    async onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

        console.log("loading siyuan-url-notes", this.i18n);

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        this.addIcons(`<symbol id="iconUrl" viewBox="0 0 1024 1024"><path d="M578.133 675.627c-3.306-3.307-8.746-3.307-12.053 0L442.133 799.573c-57.386 57.387-154.24 63.467-217.6 0-63.466-63.466-57.386-160.213 0-217.6L348.48 458.027c3.307-3.307 3.307-8.747 0-12.054l-42.453-42.453c-3.307-3.307-8.747-3.307-12.054 0L170.027 527.467c-90.24 90.24-90.24 236.266 0 326.4s236.266 90.24 326.4 0L620.373 729.92c3.307-3.307 3.307-8.747 0-12.053l-42.24-42.24z m275.84-505.6c-90.24-90.24-236.266-90.24-326.4 0L403.52 293.973c-3.307 3.307-3.307 8.747 0 12.054l42.347 42.346c3.306 3.307 8.746 3.307 12.053 0l123.947-123.946c57.386-57.387 154.24-63.467 217.6 0 63.466 63.466 57.386 160.213 0 217.6L675.52 565.973c-3.307 3.307-3.307 8.747 0 12.054l42.453 42.453c3.307 3.307 8.747 3.307 12.054 0l123.946-123.947c90.134-90.24 90.134-236.266 0-326.506z"></path><path d="M616.64 362.987c-3.307-3.307-8.747-3.307-12.053 0l-241.6 241.493c-3.307 3.307-3.307 8.747 0 12.053l42.24 42.24c3.306 3.307 8.746 3.307 12.053 0L658.773 417.28c3.307-3.307 3.307-8.747 0-12.053l-42.133-42.24z"></path></symbol>`);

        this.settingUtils = new SettingUtils({
            plugin: this, name: STORAGE_NAME
        });

        try {
            this.settingUtils.load();
        } catch (error) {
            console.error("Error loading settings storage, probably empty config json:", error);
        }

        this.protyleSlash = [{
            filter: ["URL", "Link", "Note"],
            html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconUrl"></use></svg><span class="b3-list-item__text">URL Note</span><span class="b3-list-item__meta">Ctrl+Shift+L</span></div>`,
            id: "URL Note",
            callback: this.URLNote,
        }]

        this.protyleOptions = {
            toolbar: [
                {
                    name: "insert-url-note",
                    icon: "iconUrl",
                    hotkey: "⇧⌘L",
                    tipPosition: "n",
                    tip: this.i18n.insertUrlNote,
                    click: async (protyle: Protyle) => {
                        this.URLNote(protyle);
                    }
                }
            ],
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

    // Source: https://github.com/anarion80/siyuan-oembed
    URLInputDialog = () => {
        return new Promise((resolve, reject) => {
            const dialog = new Dialog({
                content: `<div class="b3-dialog__content"><textarea class="b3-text-field fn__block" placeholder="${this.i18n.enterUrl}"></textarea></div>
                        <div class="b3-dialog__action">
                        <button class="b3-button b3-button--cancel">${this.i18n.cancel}</button><div class="fn__space"></div>
                        <button class="b3-button b3-button--text">${this.i18n.confirm}</button>
                        </div>`,
                width: "520px",
            });
            const inputElement = dialog.element.querySelector("textarea");
            const btnsElement = dialog.element.querySelectorAll(".b3-button");
            dialog.bindInput(inputElement, () => {
                (btnsElement[1] as HTMLElement).click();
            });
            inputElement.focus();
            btnsElement[0].addEventListener("click", () => {
                dialog.destroy();
                reject();
            });
            btnsElement[1].addEventListener("click", () => {
                dialog.destroy();
                resolve(inputElement.value);
            });
        });
    };

    URLNote = async (protyle: Protyle) => {
        try {
            const link = (await this.URLInputDialog()) as string;
            if (!link) {
                return;
            }

            const title = await getTitle(link);
            if (!title) {
                showMessage("Failed to fetch title");
                return;
            }

            let notebookId = protyle.protyle.notebookId
            let path = await getHPathByPath(notebookId, protyle.protyle.path)
            let fileName = getFileName(title)
            path += "/" + fileName
            let docId = await createDocWithMd(notebookId, path, `[${title}](${link})`)
            protyle.insert(`<span data-type="block-ref" data-id="${docId}" data-subtype="d">${title}</span>`, false, true);
        } catch (error) {
            console.error(error);
        }
    }
}
