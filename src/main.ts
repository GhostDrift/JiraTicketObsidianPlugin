import {App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, JiraTicketDataFetcherSettings, SampleSettingTab} from "./settings";
import {fetchJiraIssue, JiraIssue, JiraSettings} from "./jira-api";

// Remember to rename these classes and interfaces!

export default class JiraTicketDataFetcher extends Plugin {
	settings: JiraTicketDataFetcherSettings;
	lastFetchedIssue: JiraIssue | null = null; // store the last fetched issue for scripts

	api!: {
		fetchJiraIssue: (issueKey: string) => Promise<JiraIssue>;
	};

	//public method for scripts to fetch issues directly
	async fetchJiraIssue(issueKey: string): Promise<JiraIssue> {
		const issue = await fetchJiraIssue(issueKey, this.settings as JiraSettings);
		this.lastFetchedIssue = issue; // Store the fetched issue for later use
		return issue;
	}

	async onload() {
		await this.loadSettings();


		// Expose API for other plugins/scripts
		this.api = {
			fetchJiraIssue: this.fetchJiraIssue.bind(this)
		};

		//add command to fetch the jira issue and it's data.
		this.addCommand({
			id: 'jira-fetch-issue',
			name: 'Fetch Jira issue by key',
			callback: () => {
				new JiraKeyPromptModal(this.app, async (issueKey: string) => {
					try {
						const issue = await fetchJiraIssue(issueKey, this.settings as JiraSettings);
						console.log("Fetched issue:", issue);
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
		this.addSettingTab(new SampleSettingTab(this.app, this));


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

		contentEl.createEl("h2", { text: "Enter Jira issue key"});

		const inputEl = contentEl.createEl("input", {
			type: "text",
			placeholder: "e.g. KAN-123",
		}) as HTMLInputElement;

		inputEl.style.width = "100%";
		inputEl.style.marginTop = "0.5rem";

		inputEl.addEventListener("keydown", async (event) => {
			if (event.key === "Enter"){
				event.preventDefault();
				await this.submit(inputEl.value.trim());
			}
		});

		inputEl.focus();
	}

	async submit(issueKey: string) {
		if (!issueKey) {
			new Notice("Please enter a Jira issue key.");
			return;
		}
		await this.onSubmit(issueKey);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}

