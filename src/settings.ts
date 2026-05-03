import {App, PluginSettingTab, Setting} from "obsidian";
import JiraTicketDataFetcher from "./main";
import { JiraFieldMapping } from "jira-api";

export interface JiraTicketDataFetcherSettings {
	jiraBaseUrl: string;
	jiraEmail: string;
	jiraApiToken: string;
	fieldMappings: JiraFieldMapping[]; //array of field mappings
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
			updateOnOpen: true
		}, {
			jiraField: 'assignee.displayName',
			frontmatterProperty: 'assignee',
			updateOnOpen: true
		}
	] //default fields to fetch
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: JiraTicketDataFetcher;

	constructor(app: App, plugin: JiraTicketDataFetcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
		    .setName('Jira Base URL')
			.setDesc('The base URL of your Jira instance')
			.addText(text => text 
				.setPlaceholder('https://your-domain.atlassian.net')
				.setValue(this.plugin.settings.jiraBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.jiraBaseUrl = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Jira Email')
			.setDesc('The email associated with your Jira account')
			.addText(text => text
				.setPlaceholder('your-email@example.com')
				.setValue(this.plugin.settings.jiraEmail)
				.onChange(async (value) => {
					this.plugin.settings.jiraEmail = value;
					await this.plugin.saveSettings();
				})
			);
		
		new Setting(containerEl)
			.setName('Jira API Token')
			.setDesc('Your Jira API token (you can create one in your Jira account settings)')
			.addText(text => {
				text.setPlaceholder('Enter API token')
				.setValue(this.plugin.settings.jiraApiToken)
				.onChange(async (value) => {
					this.plugin.settings.jiraApiToken = value;
					await this.plugin.saveSettings();
				});
			   text.inputEl.type = 'password'; // hide the API token input for security reasons
			});

		this.plugin.settings.fieldMappings.forEach((mapping, index) => {

		    const wrapper = containerEl.createDiv("jira-mapping-card");
				
		    const header = wrapper.createDiv("jira-mapping-header");
				
		    header.createEl("h4", {
		        text: `Mapping ${index + 1}`
		    });
		
		    const deleteBtn = header.createEl("button", {
		        text: "Delete"
		    });
		
		    deleteBtn.addEventListener("click", async () => {
		        this.plugin.settings.fieldMappings.splice(index, 1);
		        await this.plugin.saveSettings();
		        this.display();
		    });
		
		    const body = wrapper.createDiv("jira-mapping-body");
		
		    // Jira Field
		    new Setting(body)
		        .setName("Jira field")
		        .setDesc("Field returned from Jira API")
		        .addText(text =>
		            text
		                .setPlaceholder("status.name")
		                .setValue(mapping.jiraField)
		                .onChange(async (value) => {
		                    mapping.jiraField = value;
		                    await this.plugin.saveSettings();
		                })
		        );
			
		    // Frontmatter property
		    new Setting(body)
		        .setName("Frontmatter key")
		        .addText(text =>
		            text
		                .setPlaceholder("status")
		                .setValue(mapping.frontmatterProperty)
		                .onChange(async (value) => {
		                    mapping.frontmatterProperty = value;
		                    await this.plugin.saveSettings();
		                })
		        );
			
		    // Toggles row (more compact)
		    const toggles = body.createDiv("jira-toggle-row");
			
		    new Setting(toggles)
		        .setName("Update on open")
		        .addToggle(toggle =>
		            toggle
		                .setValue(mapping.updateOnOpen)
		                .onChange(async (value) => {
		                    mapping.updateOnOpen = value;
		                    await this.plugin.saveSettings();
		                })
		        );
			
		    new Setting(toggles)
		        .setName("Use as alias")
		        .addToggle(toggle =>
		            toggle
		                .setValue(mapping.useAsAlias ?? false)
		                .onChange(async (value) => {
		                    mapping.useAsAlias = value;
		                    await this.plugin.saveSettings();
		                })
		        );
			
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
		});

		new Setting(containerEl)
			.setName('Add Field Mapping')
			.addButton(button => 
				button.setButtonText('Add')
					.onClick(async () => {
						this.plugin.settings.fieldMappings.push({
							jiraField: '',
							frontmatterProperty: '',
							updateOnOpen: true
						});
						await this.plugin.saveSettings();
						this.display(); // Refresh the settings UI
					})
			)
	}
}
