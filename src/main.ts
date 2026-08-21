import {Plugin, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, JiraTicketDataFetcherSettings, JiraTicketDataFetcherSettingsTab} from "./settings";
import {fetchJiraIssue, JiraIssue, timeToFetch, updateJiraFrontmatter as syncJiraIssueToFrontmatter} from "./jira-api";
import {JiraSyncBasesView, JIRA_SYNC_VIEW_TYPE} from "./bases-view";

// Remember to rename these classes and interfaces!

export default class JiraTicketDataFetcher extends Plugin {
	settings: JiraTicketDataFetcherSettings;
	private recentlyCreatedFiles = new Set<string>();


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
		await syncJiraIssueToFrontmatter(this.app, file, issueKey, this.settings, onOpenOnly ?? false);


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
								console.debug("Fetching jira issue for newly created file:", file.basename);
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
			this.registerEvent(
				this.app.vault.on("rename", async (file) => {
					if (!file) return;

					if (file instanceof TFile && file.extension === "md") { 
						console.debug("file renamed:", file?.path);
						if (timeToFetch(this.app, file,this.settings.syncInterval)){
							console.debug("Fetching jira issue for renamed file:", file.basename);
							await this.updateJiraFrontmatter(file.basename, file,  false);
						}
					}
				} )
			)
		})

		//Register the custom bases view that will sync meta data from results. 
		this.registerBasesView(JIRA_SYNC_VIEW_TYPE, {
			name: "Jira Sync",
			icon: "lucide-refresh-cw",
			factory:(controller,containerEL) =>
				new JiraSyncBasesView(controller, containerEL, this)
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


