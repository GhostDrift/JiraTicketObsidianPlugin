import {App, PluginSettingTab, Setting} from "obsidian";
import JiraTicketDataFetcher from "./main";

export interface JiraTicketDataFetcherSettings {
	jiraBaseUrl: string;
	jiraEmail: string;
	jiraApiToken: string;
	jiraFields: string; //comma-separated list of additional fields to fetch
}

export const DEFAULT_SETTINGS: JiraTicketDataFetcherSettings = {
	jiraBaseUrl: '',
	jiraEmail: '',
	jiraApiToken: '',
	jiraFields: 'status,assignee,description,summary' //default fields to fetch
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

		new Setting(containerEl)
			.setName('Jira Fields')
			.setDesc('Comma-separated list of fields to fetch')
			.addText(text => text
				.setPlaceholder('status,assignee,description,summary')
				.setValue(this.plugin.settings.jiraFields)
				.onChange(async (value) => {
					this.plugin.settings.jiraFields = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
