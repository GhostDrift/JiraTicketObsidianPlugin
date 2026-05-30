import {App, Modal, Notice, Plugin, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, JiraTicketDataFetcherSettings, JiraTicketDataFetcherSettingsTab} from "./settings";
import {fetchJiraIssue, JiraIssue, timeToFetch} from "./jira-api";

// Remember to rename these classes and interfaces!

export default class JiraTicketDataFetcher extends Plugin {
	settings: JiraTicketDataFetcherSettings;
	private recentlyCreatedFiles = new Set<string>();

	api!: {
		fetchJiraIssue: (issueKey: string, onOpenOnly?: boolean) => Promise<JiraIssue>;
		updateJiraFrontmatter: (issueKey: string, file: TFile, onOpenOnly?: boolean) => Promise<void>;
	};

	//public method for scripts to fetch issues directly
	async fetchJiraIssue(issueKey: string, onOpenOnly?: boolean): Promise<JiraIssue> {
		const issue = await fetchJiraIssue(issueKey, this.settings, {updateOnOpen: onOpenOnly ?? false});
		return issue;
	}

	async updateJiraFrontmatter(issueKey: string, file: TFile, onOpenOnly?: boolean) {
		// const file = this.app.workspace.getActiveFile();
		if (!file) {
			return;
		}
		// const tempIssue = await updateJiraFrontmatter(this.app, file, issueKey, this.settings, onOpenOnly ?? false);


	}


	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('file-open', async (file) => {
				console.debug("file opened:", file?.path);
				if (!file) return;

				if (this.settings.syncOnOpen && !this.recentlyCreatedFiles.has(file.path)) {

					if (timeToFetch(this.app, file,this.settings.syncInterval)){
						await this.updateJiraFrontmatter(file.basename, file,  true);
					}
					
				} 
				
			})
		);

		this.app.workspace.onLayoutReady(()=> {
			this.registerEvent(
				this.app.vault.on('create', async (file) => {
					if (!file) return;

					if (file instanceof TFile && file.extension === "md") {
						console.debug("file created:", file?.path);
						this.recentlyCreatedFiles.add(file.path)
						try{
							if (timeToFetch(this.app, file,this.settings.syncInterval)){
								await this.updateJiraFrontmatter(file.basename, file,  false);
							}
						} finally {
							window.setTimeout(() => {
								this.recentlyCreatedFiles.delete(file.path);
							}, 5000);
						}

					} 

				})
			);
		})
		// Expose API for other plugins/scripts
		this.api = {
			fetchJiraIssue: this.fetchJiraIssue.bind(this),
			updateJiraFrontmatter: this.updateJiraFrontmatter.bind(this)
		};

		//add command to fetch the jira issue and it's data.
		this.addCommand({
			id: 'jira-fetch-issue',
			name: 'Fetch jira issue by key',
			callback: () => {
				new JiraKeyPromptModal(this.app, async (issueKey: string) => {
					try {
						const issue = await fetchJiraIssue(issueKey, this.settings, {updateOnOpen: false});
						console.debug("Fetched issue:", issue);
						// new Notice(`Fetched issue ${issue.key}: ${issue.fields.summary}`);
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

