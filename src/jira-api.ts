//Handles JIRA API calls
import { requestUrl } from "obsidian";

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
}

export interface JiraSettings {
    jiraBaseUrl: string;
    jiraEmail: string;
    jiraApiToken: string;
}

// helper to create the authorization header for jira api
export function getJiraAuthHeader(settings: JiraSettings): string {
    //combine email and api token with a colon
    const authString = `${settings.jiraEmail}:${settings.jiraApiToken}`;
    //encode the string in base64 (built-in browser function)
    const encoded = btoa(authString);
    //return the header string
    return `Basic ${encoded}`;   
}

//Main function to fetch a Jira issue
export async function fetchJiraIssue(issueKey: string, settings: JiraSettings): Promise<JiraIssue> {
    //check if settings are complete
    if (!settings.jiraBaseUrl || !settings.jiraEmail || !settings.jiraApiToken) {
        throw new Error('Jira settings are incomplete. Please fill in all fields in the plugin settings.');
    }

    //Build the API URL
    const baseUrl = settings.jiraBaseUrl.replace(/\/$/, ''); //remove trailing slash if present
    if (!/^https?:\/\//i.test(baseUrl)) {
        throw new Error('Jira base URL must begin with https://');
    }
    const url = `${baseUrl}/rest/api/3/issue/${issueKey}`;

    //Get the auth header
    const authHeader = getJiraAuthHeader(settings);

    console.log("jira request URL:", url);
    console.log("Auth header:", authHeader.slice(0, 20) + '...')
    //Make the fetch request 
    const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
            Authorization: authHeader,
            Accept: 'application/json'
        }
    })
    // const response = await fetch(url, {
    //     method: 'GET',
    //     headers: {
    //         'Authorization': authHeader,
    //         'Accept': 'application/json'
    //     },
    // });

    //check if the request was successful
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

    return response.json as JiraIssue;
}
