import {App, Modal, Notice, Plugin, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, JiraTicketDataFetcherSettings, SampleSettingTab} from "./settings";
import {fetchJiraIssue, JiraIssue, JiraSettings, getNestedValue, resolveTemplate} from "./jira-api";

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
		this.lastFetchedIssue = issue; // Store the fetched issue for later use
		return issue;
	}

	async updateJiraFrontmatter(file: TFile){
		const issueKey = file.basename;

		//Jira key validation
		const jiraPattern = /^[A-Z]+-\d+$/i;
        console.log("issueKey:", issueKey);
		if (!jiraPattern.test(issueKey)) {
			console.log("Filename does not match Jira issue key pattern, skipping:", issueKey);
			return;
		};

		try {
			console.log("in try block, fetching issue for key:", issueKey);
			const jiraIssue = await this.fetchJiraIssue(issueKey, true);
            console.log("jira issue fields:", jiraIssue.fields);
			if (!jiraIssue?.fields) return;

			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {

				const aliasParts: string[] = [];
				
				for (const mapping of this.settings.fieldMappings) {
					if (!mapping.updateOnOpen) continue; //skip fields that are not set to update on open

					const value = getNestedValue(jiraIssue.fields, mapping.jiraField);

					if (value !== undefined) {
						frontmatter[mapping.frontmatterProperty] = value;
					}

					if (mapping.useAsAlias) {
						if (mapping.aliasTemplate) {
							aliasParts.push(resolveTemplate(mapping.aliasTemplate, jiraIssue));
						} else {
							aliasParts.push(value);
						}
					}
				}

				const existingAliases = frontmatter.aliases;

				let normalized: string[] = [];

				if (Array.isArray(existingAliases)) {
					normalized = [...existingAliases];
				} else if (typeof existingAliases === "string" && existingAliases.length > 0) {
					normalized = existingAliases.split(',').map(s => s.trim());
				}

				frontmatter.aliases = Array.from(new Set([...normalized, ...aliasParts]));
			});
		
		} catch (err) {
			console.error("Failed updating jira frontmatter", err);
		}

	}

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('file-open', async (file) => {
				console.log("file opened:", file?.path);
				if (!file) return;

				await this.updateJiraFrontmatter(file);
			})
		);
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
						const issue = await fetchJiraIssue(issueKey, this.settings as JiraSettings, false);
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

