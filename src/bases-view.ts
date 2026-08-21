import { BasesView, QueryController, TFile, Keymap, BasesEntry, BasesPropertyId} from "obsidian";
import type JiraTicketDataFetcher from "./main";
import { timeToFetch } from "./jira-api";

export const JIRA_SYNC_VIEW_TYPE = "jira-sync-view";

export class JiraSyncBasesView extends BasesView {
    readonly type = JIRA_SYNC_VIEW_TYPE;

    private containerEl: HTMLElement;
    private plugin: JiraTicketDataFetcher;
    private inFlight = new Set<string>();

    constructor(controller: QueryController, parentEl: HTMLElement, plugin: JiraTicketDataFetcher) {
        super(controller);
        this.plugin = plugin;
        this.containerEl = parentEl.createDiv("jira-sync-view");
    }

    public onDataUpdated(): void {
        this.render();
        if (this.plugin.settings.syncOnBasesQuery) {
            void this.syncEntries();
        }
    }

    private static readonly ORDER_CONFIG_KEY = "jiraSyncColumnOrder";
    private dragSourceIndex: number | null = null;

    /**
     * Bases doesn't expose a setOrder()/persistence hook for column order
     * in custom views, so we keep our own order under a custom config key
     * (config.set persists to the .base file, same mechanism other custom
     * views use for view-specific settings). Anything newly added via the
     * native Properties panel gets appended; anything removed drops out.
     */
    private getEffectiveOrder(): BasesPropertyId[] {
        const current = this.config.getOrder();
        console.debug("Current order:", current);
        const saved = (this.config.get(JiraSyncBasesView.ORDER_CONFIG_KEY) as
            | BasesPropertyId[]
            | undefined) ?? [];

        const currentSet = new Set(current);
        const ordered = saved.filter((id) => currentSet.has(id));
        const savedSet = new Set(ordered);
        for (const id of current) {
            if (!savedSet.has(id)) ordered.push(id);
        }
        return ordered;
    }

    private saveOrder(order: BasesPropertyId[]): void {
        this.config.set(JiraSyncBasesView.ORDER_CONFIG_KEY, order);
    }

    private render(): void {
        const { containerEl } = this;
        const columns = new Map<string, HTMLElement>();
        containerEl.empty();

        const entries = this.data.data;
        if (entries.length === 0) {
            containerEl.createDiv({ text: "No results.", cls: "jira-sync-empty" });
            return;
        }

        const order: BasesPropertyId[] = this.getEffectiveOrder();
        console.debug("order", order);

        const table = containerEl.createDiv({ cls: "jira-sync-table" });

        order.forEach((propId, index) => {
            const tColumn = table.createDiv({cls: "jira-sync-table-column"})
            const th = tColumn.createDiv({
                cls: "jira-sync-table-td jira-sync-table-th",
                text: this.config.getDisplayName(propId),
                attr: { draggable: "true" },
            });
            th.addEventListener("dragstart", (evt) => {
                this.dragSourceIndex = index;
                evt.dataTransfer?.setData("text/plain", String(index));
                th.addClass("jira-sync-dragging");
            });
            th.addEventListener("dragend", () => {
                th.removeClass("jira-sync-dragging");
                this.dragSourceIndex = null;
            });
            th.addEventListener("dragover", (evt) => {
                evt.preventDefault();
                th.addClass("jira-sync-drag-over");
            });
            th.addEventListener("dragleave", () => {
                th.removeClass("jira-sync-drag-over");
            });
            th.addEventListener("drop", (evt) => {
                evt.preventDefault();
                th.removeClass("jira-sync-drag-over");
                if (this.dragSourceIndex === null || this.dragSourceIndex === index) return;

                const newOrder = [...order];
                const [moved] = newOrder.splice(this.dragSourceIndex, 1);
                newOrder.splice(index, 0, moved);

                this.saveOrder(newOrder);
                this.render();
            });
            columns.set(propId,tColumn);
        });

        for (const entry of entries) {
            // uses `order` from the effective-order calc above, so column
            // position always matches the header regardless of drag state
            for (const propId of order) {
                if (columns.has(propId)){
                    const column = columns.get(propId);
                    if (column !== undefined){
                        const cell = column.createDiv({cls: "jira-sync-table-td"});
                        this.renderProperty(cell, entry, propId);
                    }
                }
            }
        }
    }

    private renderProperty(cell: HTMLElement, entry: BasesEntry, propId: BasesPropertyId): void {
        const { type, name } = this.parsePropertyId(propId);
        const value = entry.getValue(propId);

        if (!value || !value.isTruthy()) return;

        // file.name gets the same clickable-link treatment as built-in views,
        // including hover-preview support (data-href + internal-link class).
        if (type === "file" && name === "name") {
            const link = cell.createEl("a", {
                text: entry.file.basename,
                cls: "internal-link",
                href: entry.file.path,
            });
            link.dataset.href = entry.file.path;
            link.addEventListener("click", (evt) => {
                if (evt.button !== 0 && evt.button !== 1) return;
                evt.preventDefault();
                void this.app.workspace.openLinkText(entry.file.path, "", Keymap.isModEvent(evt));
            });
            return;
        } else {
            cell.setText(value.toString())
        }


    }

    private parsePropertyId(propId: BasesPropertyId): { type: string; name: string } {
        const [type, ...rest] = propId.split(".");
        return { type, name: rest.join(".") };
    } 

    private async syncEntries(): Promise<void> {
        const { app, plugin } = this;
        for (const entry of this.data.data) {
            const file = entry.file;
            if (!(file instanceof TFile)) continue;
            if (this.inFlight.has(file.path)) continue;
            if (!timeToFetch(app, file, plugin.settings.syncInterval)) continue;

            this.inFlight.add(file.path);
            plugin
                .updateJiraFrontmatter(file.basename, file, true)
                .catch((err) => console.error("Jira Bases sync failed for", file.path, err))
                .finally(() => this.inFlight.delete(file.path));
        }
    }
}