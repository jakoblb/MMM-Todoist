
# MMM-Todoist
** Developer is not actively maintaining this Extension. **
** Some extensions are created by Jakoblb **

This an extension for the [MagicMirror](https://github.com/MichMich/MagicMirror). It can display your Todoist todos. You can add multiple instances with different lists. Only one account supported.
The requests to the server will be paused is the module is not displayed (use of a carousel or hidden by Remote-Control for example) or by the use of a PIR sensor and the module MMM-PIR-Sensor. An immediate update will occurs at the return of the module display. 

## Installation
1. Navigate into your MagicMirror's `modules` folder and execute `git clone https://github.com/cbrooker/MMM-Todoist.git`. A new folder will appear navigate into it.
2. Execute `npm install` to install the node dependencies.

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:
````javascript
modules: [
	{
		module: 'MMM-Todoist',
		position: 'top_right',	// This can be any of the regions. Best results in left or right regions.
		header: 'Todoist', // This is optional
		config: { // See 'Configuration options' for more information.
			hideWhenEmpty: false,
			accessToken: 'accessToken from Todoist',
			maximumEntries: 60,
			updateInterval: 10*60*1000, // Update every 10 minutes
			fade: false,      
			// projects and/or labels is mandatory, see configuration options for more details:
			projects: [ 166564794 ], 
			labels: [ "MagicMirror", "Important" ], // Tasks for any projects with these labels will be shown.
			syncToken: "*" // Disabled by default (set to "") to allow for better backwards compatability, but is recommended
      }
	}
]
````

## Configuration options

The following properties **must** be configured:<br>
**Note** that label OR project is mandatory, not both and that currently label takes priority over project
<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Option</th>
			<th width="100%">Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>accessToken</code></td>
			<td>Your Todoist access token<br>
				<br><b>Possible values:</b> <code>string</code>
				<br><b>Default value:</b> <code>none</code>
				<br><b>Note:</b> You can use one of three values here.
				<ul>
					<li>the access token created during the oAuth process associated with your app in the <a href="https://developer.todoist.com/appconsole.html">App Management consol</a></li>
					<li>the "test token" generated in the <a href="https://developer.todoist.com/appconsole.html">App Management consol</a> without going through the steps of the oAuth token (For the web site value requested, you can use "http://example.com" if you don't have a website)</li>
					<li>the "API token" found in your account's <a href="https://todoist.com/app/settings/integrations/developer">Integration > Developer settings</a></li>
				</ul>
			</td>
		</tr>
		<tr>
			<td><code>projects</code></td>
			<td>
				Array of ProjectIDs you want to display. Can be specifiec using either a simple configuration e.g. a list of projects, or more advanced where specific sections in each projects can also be specified.<br>
				<br><b>Possible values:</b> <code>array</code>
				<br><b>Default value:</b> <code>[]</code>
				<br>
				</br><b>Simple config: array of project identifiers</b>
				<br><b>Example 1:</b> <code>projects: [166564794, 166564792],</code>
				</br></br><b>Advanced config: array of projects and sections</b>
				<br><b>Possible values:</b>
				<br><code>project</code> - Single project identifier
				<br><code>sections</code> - list of sections for the given project
				<br><code>isDissallowed</code> - whether the project (if single project), or sections are dissallowed to be displayed. (<code>false</code> by default)
				<br><b>Example 2:</b> <code>projects: [{project: 2345550300, sections: ["177869187", "177869186"], isDissallowed: false}]</code>
				<br>
				<br>
				<b>Getting the Todoist ProjectID:</b><br>
				1) Go to Todoist (Log in if you aren't)<br>
				2) Click on a Project in the left menu<br>
				3) Your browser URL will change to something like<br> <code>"https://todoist.com/app?lang=en&v=818#project%2F166564897"</code><br><br>
				Everything after %2F is the Project ID. In this case "166564897"<br><br>
				<hr />
				Alternatively, if you add <b>debug=true</b> in your config.js the Projects and ProjectsIDs will be displayed on MagicMirror as well as in the Browser console.<br><br>
				<b>This value and/or the labels entry must be specified</b>. If both projects and labels are specified, then tasks from both will be shown.</br>
				<b>Note:</b> If a section is specified, the project will <b>not be used</b>.
			</td>
		</tr>
			<tr>
			<td><code>labels</code></td>
			<td>
				Array of label names you want to display. <br>
				<br><b>Possible values:</b> <code>array</code>
				<br><b>Default value:</b> <code>[ ]</code>
				<br><b>Example:</b> <code>["MagicMirror", "Important", "DoInTheMorning"]</code>
				<br>
				<br>
				<b>This value and/or the projects entry must be specified</b>. If both projects and labels are specified, then tasks from both will be shown.
			</td>
		</tr>
	</tbody>
</table>

The following properties can be configured:
<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Option</th>
			<th width="100%">Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>blacklistProjects</code></td>
			<td>
				When this option is enabled, <code>projects</code> becomes a <i>blacklist.</i>
				Any project that is <b>not</b> in <code>projects</code> will be used.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>false</code>
				<br><b>Example:</b> <code>true</code>
				<br>
				<br>
				NB: If used in combination with <code>labels</code>, tasks that are in a blacklisted
				project but match a label will still be shown!
			</td>
		</tr>
		<tr>
			<td><code>completedTaskDisplayPeriod</code></td>
			<td>Minutes in which the data is displayed after completion in a special column even if <code>displayCompleted</code> is <code>false</code><br>
			<td><b>Note:</b> For simple implementation, this is currently always rounded to ceiling <code>updateInterval</code></br>
				<br><b>Possible values:</b> <code>int</code>
				<br><b>Default value:</b> <code>1</code>
			</td>
		</tr>
		<tr>
			<td><code>deprioritizeCompleted</code></td>
			<td>In case the <code>displaySubTasks</code> and <code>displayCompleted</code> is set, this settings ensures that completed items are not shown unless the number of non-completed items are lower than the max.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
		<tr>
			<td><code>displayAvatar</code></td>
			<td>Display avatar images of collaborators assigned to tasks in shared projects.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<td><code>displayCompleted</code></td>
			<td>If this is set, display completed tasks within the last 14 days or whatever is configured in <code>maksCompletedAgeDays</code>. Its primary purpose is to allow the user to uncomplete in case of second thoughts, or remember what was just completed.<br>
			<b>Note 1!</b> This only works with a paid version of Todoist<br>
			<b>Note 2!</b> Seems like some completed items has had their parent ID removed from Todoist side and I don't think anything can be done about this. It may be when another user adds and/or completes in a shared list.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<td><code>displayLastUpdate</code></td>
			<td>If true this will display the last update time at the end of the task list. See screenshot below<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<td><code>displayLastUpdateFormat</code></td>
			<td>Format to use for the time display if displayLastUpdate:true <br>
				<br><b>Possible values:</b> See [Moment.js formats](http://momentjs.com/docs/#/parsing/string-format/)
				<br><b>Default value:</b> <code>'dd - HH:mm:ss'</code>
			</td>
		</tr>
		<tr>
			<td><code>displaySubtasks</code></td>
			<td>Controls if subtasks are displayed or not.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
		<tr>
			<td><code>displayTasksWithinDays</code></td>
			<td>If non-negative, only display tasks with a due date within <code>displayTasksWithinDays</code> days. For instance, setting this to 0 will only show tasks due today or overdue. This will not affect tasks without a due date, <code>displayTasksWithoutDue</code> controls those.<br>
				<br><b>Possible values:</b> <code>-1</code> - <code>∞</code>
				<br><b>Default value:</b> <code>-1</code> (filtering disabled)
			</td>
		</tr>
		<tr>
			<td><code>displayTasksWithoutDue</code></td>
			<td>Controls if tasks without a due date are displayed.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
		<tr>
			<td><code>enabledTouchEvents</code></td>
			<td>Events to be sent when a part of the Todo item is pressed<br>
				<br><b>Possible values:</b> <code>array of one or more options</code>
				<code>"completeItem"</code> - Allows the user to touch the content field to complete an item.</br>
				<code>"uncompleteItem"</code> - Allows the user to touch the content field to uncomplete an item.</br>
				<br><b>Default value:</b> <code>[]</code>
			</td>
		</tr>
		<tr>
			<td><code>fade</code></td>
			<td>Fade todos to black. (Gradient)<br>
				<br><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
		<tr>
			<td><code>fadeMinimumOpacity</code></td>
			<td>Opacity of the last item if fade is enabled.<br>
				<br><b>Possible values:</b> <code>0</code> (last item is completely transparent) - <code>1</code> (no fade)
				<br><b>Default value:</b> <code>0.25</code>
			</td>
		</tr>
		<tr>
			<td><code>fadePoint</code></td>
			<td>Where to start fade?<br>
				<br><b>Possible values:</b> <code>0</code> (top of the list) - <code>1</code> (bottom of list)
				<br><b>Default value:</b> <code>0.25</code>
			</td>
		</tr>
		<tr>
			<td><code>maksCompletedAgeDays</code></td>
			<td>Number of days to look back for completed tasks<br>
			<b>Note!</b> This only works with a paid version of Todoist<br>
				<br><b>Possible values:</b> <code>int</code>
				<br><b>Default value:</b> <code>14</code>
			</td>
		</tr>
		<tr>
			<td><code>hideWhenEmpty</code></td>
			<td>Hide widget when all lists are empty (including header).<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<td><code>maxTitleLength</code></td>
			<td>Value cut the display of long tasks on several lines. See screenshot below<br>
				<br><b>Possible values:</b> <code>10</code> - <code>50</code>
				<br><b>Default value:</b> <code>25</code>
			</td>
		</tr>	
		<tr>
			<td><code>maximumEntries</code></td>
			<td>Maximum number of todos to be shown.<br>
				<br><b>Possible values:</b> <code>int</code>
				<br><b>Default value:</b> <code>10</code>
			</td>
		</tr>
		<tr>
			<td><code>maxProjectLength</code></td>
			<td>Value to cut the project name, 0 equals no limit to the length<br>
			<b>Note:<\b> Some of these values are currently hardcoded and may misbehave</br>
				<br><b>Possible values:</b> <code>int</code>
				<br><b>Default value:</b> <code>5</code>
			</td>
		</tr>
		<tr>
			<td><code>showProject</code></td>
			<td>If true this will display the Project to the right of the DueDates as it does on Todost.<br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
		<tr>
			<td><code>sortType</code></td>
			<td>This will determine the sorting method used when displaying your Todos.<br>
			<strong>Note</strong> Some sorts other than <code>todoist</code> may behave strangely with subtasks if <code>sortTypeStrict</code> is not set <strong>false</strong>.<br>
				<br><b>Possible values:</b> <br />
				<code>"todoist"</code> <span>- Sort based on the order in Todoist.</span> </br >
				<code>"priority"</code> <span>- Sort based on the priority, in Descending order. (Highest priority first)</span> </br >
				<code>"dueDateAsc"</code> <span>- Sort based on the Due Date of the Todo Ascending. (Oldest date first)</span> </br>
				<code>"dueDateDesc"</code> <span>- Sort based on the Due Date of the Todo Descending. (Newest date first)</span></br>
				<code>"dueDateDescPriority"</code> <span>- Sort based on the Due Date of the Todo Descending and by priority high to low.</span>
				<br><b>Default value:</b> <code>"todoist"</code>
			</td>
		</tr>
				<tr>
			<td><code>sortTypeStrict</code></td>
			<td>If true this will sort also subtasks based on priority which can lead to strange behavior. This setting is mainly here to maintain legacy operation with new subtask functionality.<br>
				<br><b>Possible values:</b></br>
				<code>true</code> - subtasks are not sorted under their parents but only based on sort type</br>
				<code>false</code> - parents are sorted, children will stay nested under parents and are sorted in some cases.
				<br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<td><code>syncToken</code></td>
			<td>Implementation of the syncToken now allowes for the API to only return new entries (including completed entries).<br>
				Sync token usage can be enabled by setting this value to an empty string and MMM-Todoist will get all entries from the server for each API call (legacy mode of operation)<br>
				<br><b>Possible values:</b><br>
				<code>"*"</code> <span>- Sync only recent changes is enabled.</span> </br>
				<code>""</code> <span>- Sync all per rest call (legacy mode of operation)</span>
				<br><b>Default value:</b> <code>""</code>
			</td>
		</tr>
		<tr>
			<td><code>updateInterval</code></td>
			<td>How often the module should load new todos. Be careful, this is in ms, NOT seconds! So, too low a number will lock you out for repeated server attempts!<br>
				<br><b>Possible values:</b> <code>int</code> in <code>milliseconds</code>
				<br><b>Default value:</b> <code>10*60*1000</code>
			</td>
		</tr>
		<tr>
			<td><code>wrapEvents</code></td>
			<td>If true this will display the long tasks on several lines, according on the value <code>maxTitleLength</code>. See screenshot below. <br>
				<br><b>Possible values:</b> <code>boolean</code>
				<br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<th colspan="2"> Multi-list configuration</th>
		</tr>
		<tr>
			<td><code>broadcastMode</code></td>
			<td>This setting is used if multiple lists modules are added but the user only wants to have a single entiry accessing the API.</code>. See screenshot below. <br>
				<br><b>Possible values:</b></br>
				<code>"none"</code> - Module access' the API using the configured access token in a self-contained manner.</br>
				<code>"broadcast"</code> - Module access' the API using the configured access token, and broadcasts a notification with below notification and payload. </br>
				<code>&emsp;{</br>
				&emsp;&emsp;&emsp;notification: "TODOIST_BROADCAST",</br>
				&emsp;&emsp;&emsp;payload: {</br>
				&emsp;&emsp;&emsp;&emsp;sender: &LT;module identifier&GT;,</br>
				&emsp;&emsp;&emsp;&emsp;tasksPayload: &LT;data from sync&GT,</br>
				&emsp;&emsp;&emsp;&emsp;completedPayload: &LT;data from completed sync if any&GT</br>
				&emsp;&emsp;&emsp;}</br>
				&emsp;}</code></br>
				<code>"receive"</code> - Module receives, filters, and displays data from the notification <code>"TODOIST_BROADCAST".</code> Note that if different modules broadcasts with differenc access tokens, specifying an access token with a module using "receive" configuration allows this module to filter based on the accessToken.</br>
				<br><b>Default value:</b> <code>"none"</code>
			</td>
		</tr>
	</tbody>
</table>

## Dependencies
- [request](https://www.npmjs.com/package/request) (installed via `npm install`)


# Screen shots
A few sample Screen Shots to show you what this module looks like. It's fairly configurable and changes considerably depending on how you use Todoist, how many projects you include, and how you sort.  

Option enabled: displayAvatar: true
![My image](https://raw.githubusercontent.com/thyed/MMM-Todoist/master/todoist-avatars.png)

Option enabled: displayLastUpdate: true, wrapEvents: true, maxTitleLenght: 25
![My image](https://github.com/AgP42/MMM-Todoist/blob/master/todoist.png)

Options enabled: orderBy:todoist, showProjects: true
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/1.png)  

Options enabled: orderBy:dueDateAsc, showProjects: true
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/2.png)  

Options enabled: orderBy:dueDateAsc, showProjects: false
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/3.png)  

Options enabled: orderBy:todoist, showProjects: false
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/4.png)  

Options enabled: orderBy:todoist, showProjects: true
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/5.png)  

Options enabled: orderBy:dueDateAsc, showProjects: true
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/6.png)  

Options enabled: orderBy:dueDateAsc, showProjects: false
![My image](http://cbrooker.github.io/MMM-Todoist/Screenshots/7.png)  


## Attribution

This project is based on work done by Paul-Vincent Roll in the MMM-Wunderlist module. (https://github.com/paviro/MMM-Wunderlist)


The MIT License (MIT)
=====================

Copyright © 2016 Chris Brooker

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

**The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.**
