import {App, Modal, Notice, Plugin, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, JiraTicketDataFetcherSettings, JiraTicketDataFetcherSettingsTab} from "./settings";
import {fetchJiraIssue, JiraIssue, JiraSettings, getNestedValue, resolveTemplate} from "./jira-api";

const FRONTMATTER_key = "_JTDFLastSync";

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

	timeToFetch( file: TFile, intervalMinutes: number): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter as Record<string,unknown> | undefined;
		const lastUpdate = fm?.[FRONTMATTER_key];

		if (typeof lastUpdate !== "string") {
			return true;
		}

		const lastUpdateTime = new Date(lastUpdate).getTime();

		if (isNaN(lastUpdateTime)) {
			return true;
		}

		const intervalMs = intervalMinutes * 60 * 1000;

		return ( Date.now() - lastUpdateTime > intervalMs)
	}

	async updateJiraFrontmatter(file: TFile){
		const issueKey = file.basename;

		//Jira key validation
		const jiraPattern = /^[A-Z]+-\d+$/i;
        console.debug("issueKey:", issueKey,);
		if (!jiraPattern.test(issueKey)) {
			console.debug("Filename does not match Jira issue key pattern, skipping:", issueKey);
			return;
		};

		try {
			console.debug("in try block, fetching issue for key:", issueKey);
			const jiraIssue = await this.fetchJiraIssue(issueKey, true);
            console.debug("jira issue fields:", jiraIssue.fields);
			if (!jiraIssue?.fields) return;

			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {

				const aliasParts: string[] = [];

				const fm = frontmatter as Record<string, unknown>
				
				for (const mapping of this.settings.fieldMappings) {
					if (!mapping.updateOnOpen) continue; //skip fields that are not set to update on open

					const value = getNestedValue(jiraIssue.fields, mapping.jiraField);

					if (value !== undefined) {
						fm[mapping.frontmatterProperty] = value;
					}

					if (mapping.useAsAlias) {
						if (mapping.aliasTemplate) {
							aliasParts.push(resolveTemplate(mapping.aliasTemplate, jiraIssue));
						} else {
							aliasParts.push(String(value));
						}
					}
				}

				let aliases: string[] = [];

				const existing = fm.aliases;

				if (Array.isArray(existing)) {
				    aliases = existing.map(v => String(v));
				} else if (typeof existing === "string") {
				    aliases = existing.split(",").map(s => s.trim());
				}

				fm.aliases = Array.from(new Set([...aliases, ...aliasParts]));

				fm[FRONTMATTER_key] = new Date().toISOString();
			});
		
		} catch (err) {
			console.error("Failed updating jira frontmatter", err);
		}

	}

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('file-open', async (file) => {
				console.debug("file opened:", file?.path);
				if (!file) return;

				if (this.settings.syncOnOpen) {

					if (this.settings.syncInterval === 0) {
						await this.updateJiraFrontmatter(file);
					} else {
						if (this.timeToFetch(file,this.settings.syncInterval)){
							await this.updateJiraFrontmatter(file);
						}
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

		// inputEl.style.width = "100%";
		// inputEl.style.marginTop = "0.5rem";

		// inputEl.addEventListener("keydown", async (event) => {
		// 	if (event.key === "Enter"){
		// 		event.preventDefault();
		// 		await this.submit(inputEl.value.trim());
		// 	}
		// });

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

