//Handles JIRA API calls
import { App, requestUrl, TFile } from "obsidian";
import { JiraTicketDataFetcherSettings} from "./settings";
type UnknownRecord = Record<string, unknown>;

const FRONTMATTER_key = "JTDFLastSync";

export interface JiraIssue {
    key: string;
    fields:{
        summary: string;
        status: {
            name: string;
        };
        assignee: {
            displayName: string;    
        }
        description: string;
    }
    url: string;
}

export interface JiraFieldMapping {
    jiraField: string;
    frontmatterProperty: string;
    updateOnOpen: boolean; //whether to update this field when the file is opened
    useAsAlias?: boolean; //whether to use this field as an alias in Obsidian (can be used for fields like summary)
    aliasTemplate?: string; //template for the alias property
}

// helper to create the authorization header for jira api
export function getJiraAuthHeader(settings: JiraTicketDataFetcherSettings): string {
    //combine email and api token with a colon
    const authString = `${settings.jiraEmail}:${settings.jiraApiToken}`;
    //encode the string in base64 (built-in browser function)
    const encoded = btoa(authString);
    //return the header string
    return `Basic ${encoded}`;   
}

//Main function to fetch a Jira issue
export async function fetchJiraIssue(issueKey: string, settings: JiraTicketDataFetcherSettings, updateOnOpen: boolean): Promise<JiraIssue> {
    //check if settings are complete
    if (!settings.jiraBaseUrl || !settings.jiraEmail || !settings.jiraApiToken) {
        throw new Error('Jira settings are incomplete. Please fill in all fields in the plugin settings.');
    }

    //Build the API URL
    const baseUrl = settings.jiraBaseUrl.replace(/\/$/, ''); //remove trailing slash if present
    if (!/^https?:\/\//i.test(baseUrl)) {
        throw new Error('Jira base URL must begin with https://');
    }

    //Build the fields parameter from the settings
    let fieldParams = ''
    if (updateOnOpen) {
        fieldParams = [
            ...new Set(settings.fieldMappings.filter(m => m.updateOnOpen).map(m => m.jiraField.trim().split(".")[0]).filter(Boolean))
        ].join(',');
    } else {
        fieldParams = [
            ...new Set(settings.fieldMappings.filter(m => m.jiraField?.trim()).map(m => m.jiraField.trim().split(".")[0]))
        ].join(',');
    }

    const jiraUrl = `${baseUrl}/browse/${issueKey}`

    const url = `${baseUrl}/rest/api/3/issue/${issueKey}?fields=${fieldParams}`;

    //Get the auth header
    const authHeader = getJiraAuthHeader(settings);

    // console.log("jira request URL:", url);
    // console.log("Auth header:", authHeader.slice(0, 20) + '...')
    //Make the fetch request 
    const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
            Authorization: authHeader,
            Accept: 'application/json'
        }
    })

    //check if the request was successful
    // console.log("Jira API response status:", response.status);
    if(response.status !== 200) {
        if (response.status === 401) {
        throw new Error("Authentication failed. check your jira email and API token in the plugin settings.");
        } else if (response.status === 404) {
            throw new Error (`Issue ${issueKey} not found.`);
        } else {
            throw new Error (`Jira API Error: ${response.status} ${response.text}`);
        }
    }

    //parse the json response

    const data: unknown = response.json;

    if (!data || typeof data !== "object") {
        throw new Error("Invalid Jira response");
    }
    
    const myJiraIssue = data as JiraIssue;

    myJiraIssue.url = jiraUrl;

    return myJiraIssue;
}


export function getNestedValue(
    obj: UnknownRecord,
    path: string
): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
        if (
            current &&
            typeof current === "object" &&
            key in current
        ) {
            return (current as UnknownRecord)[key];
        }
        return undefined;
    }, obj);
}

export function resolveTemplate(
    template: string,
    jiraIssue: JiraIssue
): string {
    return template.replace(/\{([^}]+)\}/g, (_, path: string) => {
        const value = getNestedValue(jiraIssue.fields as UnknownRecord, path.trim() );
        if (value == null) return "";

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        
        // handle arrays (common in Jira!)
        if (Array.isArray(value)) {
            return value.map(v => String(v)).join(", ");
        }
        
        // fallback for objects
        return "";
    });
}

export function timeToFetch( app: App, file: TFile, intervalMinutes: number): boolean {
    if (intervalMinutes === 0 ) {
        return true;
    }
	const cache = app.metadataCache.getFileCache(file);
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

export async function updateJiraFrontmatter(app: App, file: TFile, issueKey: string, settings: JiraTicketDataFetcherSettings, onOpenOnly: boolean): Promise<void | JiraIssue>{
	//Jira key validation
	const jiraPattern = /^[A-Z]+-\d+$/i;
    console.debug("issueKey:", issueKey,);
	if (!jiraPattern.test(issueKey)) {
		console.debug("Filename does not match Jira issue key pattern, skipping:", issueKey);
		return;
	};
	try {
		console.debug("in try block, fetching issue for key:", issueKey);
		const jiraIssue = await fetchJiraIssue(issueKey, settings, onOpenOnly);
        console.debug("jira issue:", jiraIssue);
		if (!jiraIssue?.fields) return;
		await app.fileManager.processFrontMatter(file, (frontmatter) => {
			const aliasParts: string[] = [];
			const fm = frontmatter as Record<string, unknown>
			
			for (const mapping of settings.fieldMappings) {
                if (onOpenOnly){
                    if (!mapping.updateOnOpen) continue; //skip fields that are not set to update on open
                }
				
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

            // set URL in frontmatter
            if (settings.syncIssueLink && !onOpenOnly) {
                fm[settings.issueLinkFrontmatter] = jiraIssue.url
            }

			fm[FRONTMATTER_key] = new Date().toISOString();
		});

        return jiraIssue;
	
	} catch (err) {
		console.error("Failed updating jira frontmatter", err);
	}
}
