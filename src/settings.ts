import {App, PluginSettingTab, Setting, FuzzySuggestModal, FuzzyMatch, TextComponent} from "obsidian";
import type JiraTicketDataFetcher from "./main";
import { JiraFieldMapping, JiraIssue, fetchJiraIssue, JiraFieldOption, suggestFrontmatterKey } from "jira-api";

export class JiraFieldSuggestModal
	extends FuzzySuggestModal<JiraFieldOption> {
	
	private initialQuery: string;

	private fieldOptions: JiraFieldOption[];

	private onChoose:
		(option: JiraFieldOption) => void | Promise<void>;

	constructor(
		app: App,
		fieldOptions: JiraFieldOption[],
		initialQuery: string,
		onChoose: (
			option: JiraFieldOption
		) => void | Promise<void>
	) {
		super(app);

		this.fieldOptions = fieldOptions;
		this.initialQuery = initialQuery;
		this.onChoose = onChoose;
	}

	override onOpen(): void{
		void super.onOpen();
		
		if(this.initialQuery) {
			this.inputEl.value = this.initialQuery;

			//tell the modal to rerun its search
			this.inputEl.dispatchEvent(
				new Event("input")
			);
		}
	}

	getItems(): JiraFieldOption[] {
		return this.fieldOptions;
	}

	getItemText(
		item: JiraFieldOption
	): string {

		return `${item.label} ${item.path}`;
	}

	onChooseItem(
		item: JiraFieldOption
	): void {

		void this.onChoose(item);
	}

	renderSuggestion(
	match: FuzzyMatch<JiraFieldOption>,
	el: HTMLElement
	): void {

		const item = match.item;

		el.createEl("div", {
			text: item.label
		});

		el.createEl("small", {
			text:
				`${item.path} • ` +
				`${item.exampleValue}`
		});
	}
}

export interface JiraTicketDataFetcherSettings {
	jiraBaseUrl: string;
	jiraEmail: string;
	jiraApiToken: string;
	fieldMappings: JiraFieldMapping[]; //array of field mappings
	syncOnOpen: boolean;
	syncInterval: number;
	syncIssueLink: boolean;
	issueLinkFrontmatter: string;
	insertLinkIntoNote: boolean;
	linkMarker: string;
	lastFetchedIssue: JiraIssue | null;
	sampleKey: string;
	fieldOptions: JiraFieldOption[];
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
			aliasTemplate: '{summary}',
			userEnteredFrontmatterProperty: false,
			uuid: "default-summary"
		}, {
			jiraField: 'status.name',
			frontmatterProperty: 'status',
			useAsAlias: false,
			updateOnOpen: true,
			userEnteredFrontmatterProperty: false,
			uuid: "default-status"
		}, {
			jiraField: 'assignee.displayName',
			frontmatterProperty: 'assignee',
			updateOnOpen: true,
			userEnteredFrontmatterProperty: false,
			uuid: "default-assignee"
		}
	], //default fields to fetch
	syncOnOpen: true,
	syncInterval: 15,
	syncIssueLink: false,
	issueLinkFrontmatter: "url",
	insertLinkIntoNote: false,
	linkMarker: "",
	lastFetchedIssue: null,
	sampleKey: "",
	fieldOptions: []
}

export class JiraTicketDataFetcherSettingsTab extends PluginSettingTab {
	plugin: JiraTicketDataFetcher;
	activeSection: string = "connection";
	expandedMappings: Set<string> = new Set();

	constructor(app: App, plugin: JiraTicketDataFetcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private renderSettings(): void {
		const {containerEl} = this;
		containerEl.empty();
		
		const layout = containerEl.createDiv("jira-settings-layout");
		const sidebar = layout.createDiv("jira-sidebar");
		const content = layout.createDiv("jira-content");

		this.renderSidebar(sidebar,content);
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
					.setPlaceholder("https://company.atlassian.net")
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
					.setPlaceholder("Enter your atalassian email address")
	                .onChange(async v => {
	                    this.plugin.settings.jiraEmail = v;
	                    await this.plugin.saveSettings();
	                })
	        )

		new Setting(card)
			.setName("API token")
			.setDesc("Generate a token at https://id.atlassian.com/manage-profile/security/api-tokens")
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
		const jiraIssueCard = this.createCard(container, "Sample Jira Issue");

		new Setting(jiraIssueCard)
			.setName("Sample key")
			.setDesc("Enter a ticket number to be used as an example to fetch all available fields for mapping use.")
			.addText(t => {
				t.setValue(this.plugin.settings.sampleKey)
				.setPlaceholder("Enter an issue key, such as cs-1234")
				.onChange( async v => {
					this.plugin.settings.sampleKey = v;
					await this.plugin.saveSettings();
				});
			});
		
		const fetchRow = jiraIssueCard.createDiv();
		fetchRow.addClass("jira-status-row");
		
		const fetchExampleBtn = fetchRow.createEl("button", {
			text: "Fetch fields"
		});

		const statusEl = fetchRow.createEl("div", {
			text: this.plugin.settings.fieldOptions.length > 0
				? "Fields available."
				: "No fields available. Fetch a sample issue to populate field options."
		});
		statusEl.addClass("jira-status-message");
		if (this.plugin.settings.fieldOptions.length > 0) {
			statusEl.addClass("jira-status-success");
		} else {
			statusEl.addClass("jira-status-error");
		}

		fetchExampleBtn.onclick = async () => {
			fetchExampleBtn.disabled = true;
			statusEl.setText("Fetching fields...");
			statusEl.removeClass("jira-status-success");
			statusEl.removeClass("jira-status-error");
			statusEl.addClass("jira-status-loading");

			try {
				await fetchJiraIssue(this.plugin.settings.sampleKey, this.plugin.settings, {allFields: true});

				if (this.plugin.settings.fieldOptions.length > 0) {
					statusEl.setText("Fields fetched successfully.");
					statusEl.removeClass("jira-status-loading");
					statusEl.addClass("jira-status-success");
				} else {
					statusEl.setText("No fields available. Fetch a sample issue to populate field options.");
					statusEl.removeClass("jira-status-loading");
					statusEl.addClass("jira-status-error");
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to fetch fields.";
				statusEl.setText(message);
				statusEl.removeClass("jira-status-loading");
				statusEl.addClass("jira-status-error");
			} finally {
				fetchExampleBtn.disabled = false;
			}
		}

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
			const newId = crypto.randomUUID();
	        this.plugin.settings.fieldMappings.push({
	            jiraField: "",
	            frontmatterProperty: "",
	            updateOnOpen: true,
			    userEnteredFrontmatterProperty: false,
				uuid: newId
	        });

			// Add the new mapping to the expanded set so it opens immediately for configuration
			this.expandedMappings.add(newId);

	        await this.plugin.saveSettings();
	        this.renderSection("fields", container);
	    };

		collapseAllBtn.onclick = () => {
			this.expandedMappings.clear();
			this.renderSection("fields", container);
		}

		expandAllBtn.onclick = () => {

		    this.expandedMappings = new Set(
				this.plugin.settings.fieldMappings.map(mapping => mapping.uuid)
			);
			this.expandedMappings.add("issue-link");
			this.renderSection("fields", container);
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

		const isExpanded = this.expandedMappings.has("issue-link");

		if (!isExpanded) {
			body.classList.add("collapsed");
			arrow.classList.add("rotated");
		}

		header.addEventListener("click", () => {
		    const isCollapsed = body.classList.toggle("collapsed");
			arrow.classList.toggle("rotated", isCollapsed);

			if (isCollapsed) {
				this.expandedMappings.delete("issue-link");
			} else {
				this.expandedMappings.add("issue-link");
			}
		});

		//Save the URL to the note frontmatter toggle
		new Setting(body)
			.setName("Save URL to frontmatter")
			.setDesc("When enabled, saves the browse URL for the issue to the frontmatter key specified below.")
			.addToggle(t => 
				t.setValue(this.plugin.settings.syncIssueLink)
					.onChange( async v => {
						this.plugin.settings.syncIssueLink = v;
						await this.plugin.saveSettings();
					})
			);
		
		//The name of the frontmatter property to save the url to. 
		new Setting(body)
			.setName("Frontmatter key")
			.addText(t =>
				t.setValue(this.plugin.settings.issueLinkFrontmatter)
				.onChange( async v => {
					this.plugin.settings.issueLinkFrontmatter = v;
					await this.plugin.saveSettings();
				})
			);
		//Toggle to control if we should attempt to insert the URL into the actual note
		new Setting(body)
			.setName("Save to note")
			.setDesc("Will insert the URL into the note after the specified line of text if present in the note when syncing data.")
			.addToggle( t => 
				t.setValue(this.plugin.settings.insertLinkIntoNote)
					.onChange(async v => {
						this.plugin.settings.insertLinkIntoNote = v;
						await this.plugin.saveSettings();
			
					})
			);
		
		//Line of Text to insert the URL next inside the note if present. 
		new Setting(body)
			.setName("URL marker")
			.setDesc("The line of text the plugin will look for to insert the URL next to. For example, ## jira: will cause the URL to be inserted as such: ## jira: https://....")
			.addText(t =>
				t.setValue(this.plugin.settings.linkMarker)
					.onChange( async v => {
						this.plugin.settings.linkMarker = v;
						await this.plugin.saveSettings();
					})
			);
		

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
			
			const isExpanded = this.expandedMappings.has(mapping.uuid);

			if (!isExpanded) {
				body.classList.add("collapsed");
				arrow.classList.add("rotated");
			}

	        header.addEventListener("click", () => {
			    const isCollapsed = body.classList.toggle("collapsed");
				arrow.classList.toggle("rotated", isCollapsed);

				if (isCollapsed) {
					this.expandedMappings.delete(mapping.uuid);
				} else {
					this.expandedMappings.add(mapping.uuid);
				}
			});

	        // fields inside collapsible body
	        new Setting(body)
	            .setName("Jira field")
				.addButton(button =>
					button
						.setButtonText(
							mapping.jiraField || "Select Field"
						)
						.onClick(() => {
						    const searchText = mapping.userEnteredFrontmatterProperty ? mapping.frontmatterProperty : "";
							new JiraFieldSuggestModal(
								this.app,
								this.plugin.settings.fieldOptions,
								searchText,
							    (option) => {
								
									mapping.jiraField =
										option.path;

									if (!mapping.frontmatterProperty && !mapping.userEnteredFrontmatterProperty) {
										mapping.frontmatterProperty = suggestFrontmatterKey(option.path, option.label);
									}
								
								    void this.plugin.saveSettings()
								    
									this.renderSettings();
								}
							).open();
						})
				);
            
	        new Setting(body)
	            .setName("Frontmatter key")
	            .addText(t =>
	                t.setValue(mapping.frontmatterProperty)
	                    .onChange(async v => {
	                        mapping.frontmatterProperty = v;
							
							if (mapping.frontmatterProperty === "") {
								mapping.userEnteredFrontmatterProperty = false;
							} else {
								mapping.userEnteredFrontmatterProperty = true;
							}
							
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
			let aliasTemplateText: TextComponent;
		    new Setting(body)
		        .setName("Alias template")
		        .setDesc("{summary}, {status.name}, etc.")
		        .addText(text => {
					aliasTemplateText = text;
		            text
		                .setPlaceholder("{summary} - {status.name}")
		                .setValue(mapping.aliasTemplate ?? "")
		                .onChange(async (value) => {
		                    mapping.aliasTemplate = value;
		                    await this.plugin.saveSettings();
		                })
				})
				.addButton(button => 
					button
						.setButtonText("Insert field")
						.onClick(() => {
							const allowedFieldOptions = this.plugin.settings.fieldOptions.filter(option => this.plugin.settings.fieldMappings.some(mapping => mapping.jiraField?.trim() === option.path));
							new JiraFieldSuggestModal(
								this.app,
								allowedFieldOptions,
								"",
								async (option) => {
									const inputEl = aliasTemplateText.inputEl;
									const placeholder = `{${option.path}}`;
									const start = inputEl.selectionStart ?? inputEl.value.length;
									const end = inputEl.selectionEnd ?? start;
									const newValue = 
									    inputEl.value.slice(0, start) + 
										placeholder + 
										inputEl.value.slice(end);
									mapping.aliasTemplate = newValue;
									await this.plugin.saveSettings();
									this.renderSettings(); 
								}
							).open();
						})
				)

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
