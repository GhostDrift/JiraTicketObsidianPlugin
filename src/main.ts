import {App, Modal, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, JiraTicketDataFetcherSettings, JiraTicketDataFetcherSettingsTab} from "./settings";
import {fetchJiraIssue, JiraIssue, JiraSettings, updateJiraFrontmatter, timeToFetch} from "./jira-api";

// Remember to rename these classes and interfaces!

export default class JiraTicketDataFetcher extends Plugin {
	settings: JiraTicketDataFetcherSettings;
	lastFetchedIssue: JiraIssue | null = null; // store the last fetched issue for scripts

	api!: {
		fetchJiraIssue: (issueKey: string, updateOnOpen?: boolean) => Promise<JiraIssue>;
	};

	//public method for scripts to fetch issues directly
	async fetchJiraIssue(issueKey: string, updateOnOpen?: boolean): Promise<JiraIssue> {
		const issue = await fetchJiraIssue(issueKey, this.settings as JiraSettings, updateOnOpen ?? false);
		return issue;
	}

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('file-open', async (file) => {
				console.debug("file opened:", file?.path);
				if (!file) return;

				if (this.settings.syncOnOpen) {

					if (timeToFetch(this.app, file,this.settings.syncInterval)){
						await updateJiraFrontmatter(this.app, file, this.settings, true);
					}
					
				} 
				
			})
		);
		// Expose API for other plugins/scripts
		this.api = {
			fetchJiraIssue: this.fetchJiraIssue.bind(this)
		};

		//add command to fetch the jira issue and it's data.
		this.addCommand({
			id: 'jira-fetch-issue',
			name: 'Fetch jira issue by key',
			callback: () => {
				new JiraKeyPromptModal(this.app, async (issueKey: string) => {
					try {
						const issue = await fetchJiraIssue(issueKey, this.settings as JiraSettings, false);
						console.debug("Fetched issue:", issue);
						new Notice(`Fetched issue ${issue.key}: ${issue.fields.summary}`);
						// Here you could also do something with the fetched issue data, like inserting it into the current note.
					} catch (error) {
						if (error instanceof Error) {
							new Notice(`Error fetching issue: ${error.message}`);
						} else {
							new Notice('An unknown error occurred while fetching the issue.');
						}
					}
				}).open();
			}
		});

		

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new JiraTicketDataFetcherSettingsTab(this.app, this as JiraTicketDataFetcher));


	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<JiraTicketDataFetcherSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class JiraKeyPromptModal extends Modal {
	private onSubmit: (issueKey: string) => Promise<void>;

	constructor(app: App, onSubmit: (issueKey: string) => Promise<void>) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;

		contentEl.createEl("h2", { text: "Enter jira issue key"});

		const inputEl = contentEl.createEl("input", {
			type: "text",
			placeholder: "e.g. KAN-123",
		});

		inputEl.addClass("Jira-ticket-prompt")

		inputEl.addEventListener("keydown", (event) => {
		    if (event.key === "Enter") {
		        event.preventDefault();
			
		        void this.submit(inputEl.value.trim());
		    }
		});

		inputEl.focus();
	}

	async submit(issueKey: string) {
		if (!issueKey) {
			new Notice("Please enter a jira issue key.");
			return;
		}
		await this.onSubmit(issueKey);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}

