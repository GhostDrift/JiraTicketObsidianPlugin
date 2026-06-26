# Jira Ticket Data Fetcher

Fetch Jira issue data into note frontmatter and optionally insert the issue URL into notes. 
## What it does
- Fetches Jira issue fields for a note based on the note's filename.
- Writes Jira field values into the note's frontmatter.
- Can build a note alias from fetched Jira values using a template.
- Can optionally insert the Jira issue URL into the note content.

## Setup for users
1. Install and enable the plugin in Obsidian.
2. Open the plugin settings tab in Obsidian.
3. Configure:
   - `Base URL`: your Jira instance, e.g. `https://yourcompany.atlassian.net`
   - `Email`: your Atlassian account email
   - `API token`: an Atlassian API token from https://id.atlassian.com/manage-profile/security/api-tokens

Without valid Jira connection settings, the plugin cannot fetch issue data.

## How to use
### 1. Name a note after a Jira issue key
The plugin uses the note basename as the Jira issue key.
Examples:
- `PROJ-123.md`
- `JIRA-456.md`

If the filename matches a Jira key pattern, the plugin will try to fetch issue data.

### 2. Configure field mappings
In the Field Mappings section, add or edit mappings to choose which Jira fields are saved.
Each mapping includes:
- `Jira field`: select a Jira field using the picker.
- `Frontmatter key`: the name saved in the note frontmatter.
- `Update on open`: when enabled, the field is refreshed when the note opens.
- `Use as alias`: when enabled, this mapping contributes to the note alias.
- `Alias template`: a template string using placeholders like `{summary}` and `{account}`.

#### Sample key usage
Use `Sample key` and click `Fetch fields` to load real Jira fields from an example issue.
This populates the field picker used when creating mappings.

### 3. Use alias templates
Alias templates let you combine multiple Jira fields into a friendly alias.
Example template:
- `{account} - {summary}`

Important:
- Templates use single braces: `{field.path}`.
- The plugin resolves placeholders from fetched Jira issue data.
- You can type text freely and use the `Insert field` button to add placeholders from mapped fields.

## Sync behavior
- `Sync on open`: fetches data when a note is opened, if its filename looks like a Jira key.
- `Sync issue link`: saves the issue URL into frontmatter.
- `Save to note`: inserts the issue URL into the note near your configured marker.
- `Sync interval`: minimum minutes between fetches, to reduce API usage.

The plugin also attempts fetches for newly created notes and on note rename.

## Troubleshooting
- If `Fetch fields` does not populate field choices, verify your Jira connection settings and sample key.
- Templates must use single braces like `{summary}`, not `{{summary}}`.

## Example workflow
1. Enable the plugin in Obsidian.
2. Configure Jira connection settings.
3. Add field mappings for the fields you want in frontmatter.
4. Open or rename a note to a Jira issue key.
5. The plugin fetches data, updates frontmatter, and applies aliases.

## Notes for users
- Frontmatter values will be updated only for mappings that are enabled and match your sync rules.
- Alias strings are built from mappings marked `Use as alias`.
- The plugin stores the last sync time in frontmatter to honor `syncInterval`.
