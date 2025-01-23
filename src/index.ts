import {
    Plugin,
    getFrontend,
    getBackend,
    Custom,
    Dialog,
    Protyle,
    showMessage,
    IProtyle,
} from "siyuan";
import "@/index.scss";

import { createDocWithMd, getHPathByPath } from "./api";
import { getUrlContent } from "./utils/url";
import { trimEmptyLines } from "./utils/strings";
import { SettingsManager } from "./settings";

export default class UrlNotesPlugin extends Plugin {
    customTab: () => Custom;
    private isMobile: boolean;
    private settingsManager: SettingsManager;

    includeContent = () => {
        return this.settingsManager.getPref("includeContent");
    }

    convertPaste = () => {
        return this.settingsManager.getPref("convertPaste");
    }

    // Initial source: https://github.com/anarion80/siyuan-oembed
    URLInputDialog = (protyle: Protyle, rangeString: string) => {
        return new Promise<[string, boolean]>((resolve, reject) => {
            let includeContent = this.includeContent();
            const dialog = new Dialog({
                content: `<div class="b3-dialog__content"><textarea class="b3-text-field fn__block" placeholder="${this.i18n.enterUrl}"></textarea></div>
                        <div style="margin-left: 22px; margin-bottom: 5px" class="b3-switch__container">
                        <label for="includeContent">${this.i18n.includeContent}<div class="fn__space" style="width: 280px;"></div></label>
                        <input type="checkbox" id="includeContent" name="includeContent" ${includeContent ? 'checked' : ''} class="b3-switch"/>
                        </div>
                        <div class="b3-dialog__action">
                        <button class="b3-button b3-button--cancel">${this.i18n.cancel}</button><div class="fn__space"></div>
                        <button class="b3-button b3-button--text">${this.i18n.confirm}</button>
                        </div>`,
                width: "520px",
                destroyCallback: () => {
                    if (rangeString == null)
                        protyle.insert(window.Lute.Caret, false, true);
                }
            });

            const inputElement = dialog.element.querySelector("textarea");
            const btnsElement = dialog.element.querySelectorAll(".b3-button");
            const checkboxElement = dialog.element.querySelector('#includeContent');
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
                resolve([inputElement.value, includeContent]);
            });
            checkboxElement.addEventListener('change', () => {
                includeContent = (checkboxElement as HTMLInputElement).checked;
            });
        });
    };

    createURLNote = async(
        protyle: Protyle,
        link: string,
        includeContent: boolean,
        title: string = null,
        useRef: boolean = false,
        abortOnFailure: boolean = false
    ) => {
        let { urlTitle, urlContent } = await getUrlContent(link);
        if (!urlTitle) {
            showMessage("Failed to fetch title");

            if (abortOnFailure) {
                protyle.insert(link, false, true);
                return;
            }

            urlTitle = link;
        }

        includeContent = includeContent && urlContent != null;

        if (!title) title = urlTitle;

        const notebookId = protyle.protyle.notebookId
        const path = `${await getHPathByPath(notebookId,
            protyle.protyle.path)}/${title.replace(/\//g, " ")}`;

        const docContent = includeContent ?
            trimEmptyLines(urlContent) : `[${urlTitle}](${link})`;
        const docId = await createDocWithMd(notebookId, path, docContent);

        if (useRef)
            protyle.insert(`<span data-type="block-ref" data-id="${docId}" data-subtype="d">${title}</span>`, false, true);
        else
            protyle.insert(`[${title}](siyuan://blocks/${docId})`, false, true);
    }

    createURLNoteWithDialog = async (protyle: Protyle, useRef: boolean = true) => {
        let selectElement = protyle.protyle.contentElement
        let rangeString = protyle.getRange(selectElement).toString().trim();

        if (rangeString.length == 0 || rangeString.startsWith("/"))
            rangeString = null;

        let title = rangeString

        try {
            let [ link, includeContent ] = (await this.URLInputDialog(protyle, rangeString))

            if (!link) {
                return;
            }

            await this.createURLNote(protyle, link, includeContent, title, useRef);
        } catch (error) {
            console.error(error);
        }
    }

    updateProtyleToolbar = (toolbar) => {
        toolbar.push(
            {
                name: "insert-url-note-ref",
                icon: "iconUrl",
                hotkey: "⇧⌘,",
                tipPosition: "n",
                tip: this.i18n.urlRefNote,
                click: async (protyle: Protyle) => {
                    this.createURLNoteWithDialog(protyle, true);
                }
            },
            {
                name: "insert-url-note-link",
                icon: "iconUrl",
                hotkey: "⇧⌘L",
                tipPosition: "n",
                tip: this.i18n.urlLinkNote,
                click: async (protyle: Protyle) => {
                    this.createURLNoteWithDialog(protyle, false);
                }
            },
        )
        return toolbar;
    }

    private eventBusPaste(event: any) {
        event.preventDefault();

        let text = event.detail.textPlain;
        let protyle = (event.detail.protyle as IProtyle).getInstance();

        if (this.convertPaste() && text.startsWith("http")) {
            try {
                this.createURLNote(protyle, text,
                    this.includeContent(), null, false, true);
            } catch (error) {
                showMessage(error);
            }
        } else {
            event.detail.resolve({
                textPlain: event.detail.textPlain.trim(),
            });
        }
    }

    async onload() {
        this.settingsManager = new SettingsManager(this);
        this.settingsManager.setupSettings();

        console.log("loading url-bookmark-notes", this.i18n);

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        this.addIcons(`<symbol id="iconUrl" viewBox="0 0 1024 1024"><path d="M578.133 675.627c-3.306-3.307-8.746-3.307-12.053 0L442.133 799.573c-57.386 57.387-154.24 63.467-217.6 0-63.466-63.466-57.386-160.213 0-217.6L348.48 458.027c3.307-3.307 3.307-8.747 0-12.054l-42.453-42.453c-3.307-3.307-8.747-3.307-12.054 0L170.027 527.467c-90.24 90.24-90.24 236.266 0 326.4s236.266 90.24 326.4 0L620.373 729.92c3.307-3.307 3.307-8.747 0-12.053l-42.24-42.24z m275.84-505.6c-90.24-90.24-236.266-90.24-326.4 0L403.52 293.973c-3.307 3.307-3.307 8.747 0 12.054l42.347 42.346c3.306 3.307 8.746 3.307 12.053 0l123.947-123.946c57.386-57.387 154.24-63.467 217.6 0 63.466 63.466 57.386 160.213 0 217.6L675.52 565.973c-3.307 3.307-3.307 8.747 0 12.054l42.453 42.453c3.307 3.307 8.747 3.307 12.054 0l123.946-123.947c90.134-90.24 90.134-236.266 0-326.506z"></path><path d="M616.64 362.987c-3.307-3.307-8.747-3.307-12.053 0l-241.6 241.493c-3.307 3.307-3.307 8.747 0 12.053l42.24 42.24c3.306 3.307 8.746 3.307 12.053 0L658.773 417.28c3.307-3.307 3.307-8.747 0-12.053l-42.133-42.24z"></path></symbol>`);

        this.protyleSlash = [
            {
                filter: ["URL", "Link", "Note", "Ref", "URLRef"],
                html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconUrl"></use></svg><span class="b3-list-item__text">${this.i18n.urlRefNote}</span><span class="b3-list-item__meta">Ctrl+Shift+,</span></div>`,
                id: "URL Note Ref",
                callback: async (protyle: Protyle) => {
                    this.createURLNoteWithDialog(protyle, true);
                }
            },
            {
                filter: ["URL", "Link", "Note", "URLLink"],
                html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconUrl"></use></svg><span class="b3-list-item__text">${this.i18n.urlLinkNote}</span><span class="b3-list-item__meta">Ctrl+Shift+L</span></div>`,
                id: "URL Note Link",
                callback: async (protyle: Protyle) => {
                    this.createURLNoteWithDialog(protyle, false);
                }
            },
        ]

        this.eventBus.on("paste", (e) => this.eventBusPaste(e));
    }

    onLayoutReady() {
        this.settingsManager.onLayoutReady();
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
    }

    async onunload() {
        console.log("onunload");
    }

    uninstall() {
        console.log("uninstall");
    }
}
