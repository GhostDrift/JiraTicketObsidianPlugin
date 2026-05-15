import {App, PluginSettingTab, Setting} from "obsidian";
import type JiraTicketDataFetcher from "./main";
import { JiraFieldMapping } from "jira-api";

export interface JiraTicketDataFetcherSettings {
	jiraBaseUrl: string;
	jiraEmail: string;
	jiraApiToken: string;
	fieldMappings: JiraFieldMapping[]; //array of field mappings
	syncOnOpen: boolean;
	syncInterval: number;
	syncIssueLink: boolean;
	issueLinkFrontmatter: string;
}

export const DEFAULT_SETTINGS: JiraTicketDataFetcherSettings = {
	jiraBaseUrl: '',
	jiraEmail: '',
	jiraApiToken: '',
	fieldMappings: [
		{
			jiraField: 'summary',
			frontmatterProperty: 'summary',
			updateOnOpen: true,
			useAsAlias: true,
			aliasTemplate: '{{summary}}'
		}, {
			jiraField: 'status.name',
			frontmatterProperty: 'status',
			useAsAlias: false,
			updateOnOpen: true
		}, {
			jiraField: 'assignee.displayName',
			frontmatterProperty: 'assignee',
			updateOnOpen: true
		}
	], //default fields to fetch
	syncOnOpen: true,
	syncInterval: 15,
	syncIssueLink: false,
	issueLinkFrontmatter: "url"
}

export class JiraTicketDataFetcherSettingsTab extends PluginSettingTab {
	plugin: JiraTicketDataFetcher;
	activeSection: string = "connection";

	constructor(app: App, plugin: JiraTicketDataFetcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
	    const { containerEl } = this;
	    containerEl.empty();

	    const layout = containerEl.createDiv("jira-settings-layout");

	    const sidebar = layout.createDiv("jira-sidebar");
	    const content = layout.createDiv("jira-content");

	    this.renderSidebar(sidebar, content);
	}

	renderSidebar(sidebar: HTMLElement, content: HTMLElement) {

	    const sections = [
	        { id: "connection", name: "Jira Connection" },
	        { id: "sync", name: "Sync Behavior" },
	        { id: "fields", name: "Field Mappings" }
	    ];

		const setActive = (id: string) => {
			this.activeSection = id;

			sidebar.querySelectorAll(".jira-sidebar-item")
				.forEach(el => el.removeClass("active"));

			const activeBtn = sidebar.querySelector(
				`[data-section-id="${id}"]`
			);

			activeBtn?.addClass("active");
		}

	    sections.forEach(section => {
	        const btn = sidebar.createEl("div", {
	            text: section.name,
	            cls: "jira-sidebar-item"
	        });

			btn.setAttribute("data-section-id", section.id)

	        btn.addEventListener("click", () => {
	            content.empty();
	            this.renderSection(section.id, content);

				setActive(section.id);
	        });
	    });

	    // default view
	    setActive(this.activeSection || "connection");
		this.renderSection(this.activeSection || "connection", content);
	}

	renderSection(id: string, container: HTMLElement) {

	    container.empty();

	    switch (id) {

	        case "connection":
	            this.renderConnection(container);
	            break;

	        case "sync":
	            this.renderSync(container);
	            break;

	        case "fields":
	            this.renderFieldMappings(container);
	            break;

	    }
	}

	createCard(container: HTMLElement, title: string) {
	    const card = container.createDiv("jira-card");
		// eslint-disable-next-line obsidianmd/settings-tab/no-manual-html-headings
	    card.createEl("h3", { text: title });

	    return card;
	}

	renderConnection(container: HTMLElement) {

	    const card = this.createCard(container, "Jira Connection");

	    new Setting(card)
	        .setName("Base URL")
	        .addText(text =>
	            text
	                .setValue(this.plugin.settings.jiraBaseUrl)
	                .onChange(async v => {
	                    this.plugin.settings.jiraBaseUrl = v;
	                    await this.plugin.saveSettings();
	                })
	        );

	    new Setting(card)
	        .setName("Email")
	        .addText(text =>
	            text
	                .setValue(this.plugin.settings.jiraEmail)
	                .onChange(async v => {
	                    this.plugin.settings.jiraEmail = v;
	                    await this.plugin.saveSettings();
	                })
	        )

		new Setting(card)
			.setName("API token")
			.addText(text => {
				text
					.setValue(this.plugin.settings.jiraApiToken)
					.onChange(async v => {
						this.plugin.settings.jiraApiToken = v;
						await this.plugin.saveSettings();
					})
					text.inputEl.type = 'password';
				}
			);
	}

	renderFieldMappings(container: HTMLElement) {

	    const card = this.createCard(container, "Field Mappings");

	    const addBtn = card.createEl("button", {
	        text: "Add mapping",
	        cls: "jira-add-btn"
	    });

		const collapseAllBtn = card.createEl("button", {
			text: "Collapse all",
			cls: "jira-collapse-all-btn"
		})

		const expandAllBtn = card.createEl("button", {
		    text: "Expand all",
		    cls: "jira-expand-all-btn"
		});
		
	    addBtn.onclick = async () => {
	        this.plugin.settings.fieldMappings.push({
	            jiraField: "",
	            frontmatterProperty: "",
	            updateOnOpen: true
	        });

	        await this.plugin.saveSettings();
	        this.renderSection("fields", container);
	    };

		collapseAllBtn.onclick = () => {
			const wrappers = card.querySelectorAll(".jira-mapping");
			wrappers.forEach(wrapper => {
				const body = wrapper.querySelector(".jira-mapping-body");
				const arrow = wrapper.querySelector(".jira-collapse-arrow");

				if (!body || !arrow) return;

				body.classList.add("collapsed")
				arrow.classList.add("rotated")
			})
		}

		expandAllBtn.onclick = () => {
		    const wrappers = card.querySelectorAll(".jira-mapping");

		    wrappers.forEach(wrapper => {
		        const body = wrapper.querySelector(".jira-mapping-body");
		        const arrow = wrapper.querySelector(".jira-collapse-arrow");
			
		        if (!body || !arrow) return;
			
		        body.classList.remove("collapsed");
		        arrow.classList.remove("rotated");
		    });
		};

		//Save the issue URL to the frontmatter settings
		const wrapper = card.createDiv("jira-mapping");

		const header = wrapper.createDiv("jira-mapping-header");

		const title = header.createDiv("jira-mapping-title");

		title.createSpan({text: "Issue Link"});

		const arrow = header.createSpan({
			text: "▶",
			cls: "jira-collapse-arrow"
		})

		const body = wrapper.createDiv("jira-mapping-body");

		body.classList.add("collapsed");
		arrow.classList.add("rotated")

		header.addEventListener("click", () => {
		    const isCollapsed = body.classList.toggle("collapsed");

		    arrow.classList.toggle("rotated", isCollapsed);
		});

		new Setting(body)
			.setName("Save URL to frontmatter")
			.setDesc("When on, will save the browse url for your issue to the frontmatter key specified below")
			.addToggle(t => 
				t.setValue(this.plugin.settings.syncIssueLink)
					.onChange( async v => {
						this.plugin.settings.syncIssueLink = v;
						await this.plugin.saveSettings();
					})
			);
		new Setting(body)
			.setName("Frontmatter Key")
			.addText(t =>
				t.setValue(this.plugin.settings.issueLinkFrontmatter)
				.onChange( async v => {
					this.plugin.settings.issueLinkFrontmatter = v;
					await this.plugin.saveSettings();
				})
			)

	    this.plugin.settings.fieldMappings.forEach((mapping, index) => {

	        const wrapper = card.createDiv("jira-mapping");

	        // HEADER (collapsible)
	        const header = wrapper.createDiv("jira-mapping-header");

			const title = header.createDiv("jira-mapping-title");

			title.createSpan({ text: mapping.frontmatterProperty || "New Mapping"});

			const arrow = header.createSpan({
				text: "▶",
				cls: "jira-collapse-arrow"
			})

	        const body = wrapper.createDiv("jira-mapping-body");
			
			body.classList.add("collapsed");
			arrow.classList.add("rotated")

	        header.addEventListener("click", () => {
			    const isCollapsed = body.classList.toggle("collapsed");

			    arrow.classList.toggle("rotated", isCollapsed);
			});

	        // fields inside collapsible body
	        new Setting(body)
	            .setName("Jira field")
	            .addText(t =>
	                t.setValue(mapping.jiraField)
	                    .onChange(async v => {
	                        mapping.jiraField = v;
	                        await this.plugin.saveSettings();
	                    })
	            );

	        new Setting(body)
	            .setName("Frontmatter key")
	            .addText(t =>
	                t.setValue(mapping.frontmatterProperty)
	                    .onChange(async v => {
	                        mapping.frontmatterProperty = v;
	                        await this.plugin.saveSettings();
	                    })
	            );

	        new Setting(body)
	            .addToggle(t =>
	                t.setValue(mapping.updateOnOpen)
	                    .onChange(async v => {
	                        mapping.updateOnOpen = v;
	                        await this.plugin.saveSettings();
	                    })
	            )
	            .setName("Update on open");
		    new Setting(body)
			    .addToggle(t =>
					t.setValue(mapping.useAsAlias ?? false)
	                    .onChange(async v => {
	                        mapping.useAsAlias = v;
	                        await this.plugin.saveSettings();
	                    })
				)
		        .setName("Use as alias")

		    // Alias template
		    new Setting(body)
		        .setName("Alias template")
		        .setDesc("{summary}, {status.name}, etc.")
		        .addText(text =>
		            text
		                .setPlaceholder("{summary} - {status.name}")
		                .setValue(mapping.aliasTemplate ?? "")
		                .onChange(async (value) => {
		                    mapping.aliasTemplate = value;
		                    await this.plugin.saveSettings();
		                })
		        );

	        new Setting(body)
	            .addButton(btn =>
	                btn
	                    .setButtonText("Delete")
	                    .setWarning()
	                    .onClick(async () => {
	                        this.plugin.settings.fieldMappings.splice(index, 1);
	                        await this.plugin.saveSettings();
	                        this.renderSection("fields", container);
	                    })
	            );
	    });
	}

	renderSync(container: HTMLElement){
		const card = this.createCard(container, "Sync Settings");

		new Setting(card)
			.setName("Sync on open")
			.setDesc("Fetch data from jira on note open, uses note name as jira key")
			.addToggle(t =>
				t.setValue(this.plugin.settings.syncOnOpen)
					.onChange(async v => {
						this.plugin.settings.syncOnOpen = v;
						await this.plugin.saveSettings();
					})
			)
		
		new Setting(card)
			.setName("Sync interval")
			.setDesc("The minimum amount of time between sync calls in minutes, reduces API usage.")
			.addText( text => text
				.setValue(String(this.plugin.settings.syncInterval))
				.onChange( async (value) => {
					text.inputEl.type = "number";
					this.plugin.settings.syncInterval = Number(value);
					await this.plugin.saveSettings();
				})

			);
	}
}
