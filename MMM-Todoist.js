/* global Module */

/* Magic Mirror
 * Module: MMM-Todoist
 *
 * By Chris Brooker
 *
 * MIT Licensed.
 */

/*
 * Update by mabahj 24/11/2019
 * - Added support for labels in addtion to projects
 * Update by AgP42 the 18/07/2018
 * Modification added :
 * - Management of a PIR sensor with the module MMM-PIR-Sensor (by PaViRo). In case PIR module detect no user,
 * the update of the ToDoIst is stopped and will be requested again at the return of the user
 * - Management of the "module.hidden" by the core system : same behaviour as "User_Presence" by the PIR sensor
 * - Add "Loading..." display when the infos are not yet loaded from the server
 * - Possibility to add the last update time from server at the end of the module.
 * This can be configured using "displayLastUpdate" and "displayLastUpdateFormat"
 * - Possibility to display long task on several lines(using the code from default module "calendar".
 * This can be configured using "wrapEvents" and "maxTitleLength"
 *
 * // Update 27/07/2018 :
 * - Correction of start-up update bug
 * - correction of regression on commit #28 for tasks without dueDate
 * */

//UserPresence Management (PIR sensor)
var UserPresence = true; //true by default, so no impact for user without a PIR sensor

Module.register("MMM-Todoist", {

	defaults: {
		maximumEntries: 10,
		projects: [],
		blacklistProjects: false,
	    labels: [""],
		updateInterval: 10 * 60 * 1000, // every 10 minutes,
		fade: true,
		fadePoint: 0.25,
		fadeMinimumOpacity: 0.25,
		sortType: "todoist",

		//New config from AgP42
		displayLastUpdate: false, //add or not a line after the tasks with the last server update time
		displayLastUpdateFormat: "dd - HH:mm:ss", //format to display the last update. See Moment.js documentation for all display possibilities
		maxTitleLength: 25, //10 to 50. Value to cut the line if wrapEvents: true
		wrapEvents: false, // wrap events to multiple lines breaking at maxTitleLength
		displayTasksWithoutDue: true, // Set to false to not print tasks without a due date
		displayTasksWithinDays: -1, // If >= 0, do not print tasks with a due date more than this number of days into the future (e.g., 0 prints today and overdue)
		// 2019-12-31 by thyed
		displaySubtasks: true, // set to false to exclude subtasks
		displayAvatar: false,
		// december 2024 by JakobLB
		displayCompleted: true,
		maksCompletedAgeDays: 14,//number of days to look back for completed tasks
		sortTypeStrict: false, // Whether subtasks will stay under their parents task even if the priority is different
		deprioritizeCompleted: true,
		broadcastMode: "none", // Multiple lists optimisation - can be "none", "receive", or "broadcast"
		maxProjectLength: 5, // value to cut the project name
		// Other
		showProject: true,
		// projectColors: ["#95ef63", "#ff8581", "#ffc471", "#f9ec75", "#a8c8e4", "#d2b8a3", "#e2a8e4", "#cccccc", "#fb886e",
		// 	"#ffcc00", "#74e8d3", "#3bd5fb", "#dc4fad", "#ac193d", "#d24726", "#82ba00", "#03b3b2", "#008299",
		// 	"#5db2ff", "#0072c6", "#000000", "#777777"
		// ], //These colors come from Todoist and their order matters if you want the colors to match your Todoist project colors.
		
		//TODOIST Change how they are doing Project Colors, so now I'm changing it.
		projectColors: {
			30:'#b8256f',
			31:'#db4035',
			32:'#ff9933',
			33:'#fad000',
			34:'#afb83b',
			35:'#7ecc49',
			36:'#299438',
			37:'#6accbc',
			38:'#158fad',
			39:'#14aaf5',
			40:'#96c3eb',
			41:'#4073ff',
			42:'#884dff',
			43:'#af38eb',
			44:'#eb96eb',
			45:'#e05194',
			46:'#ff8d85',
			47:'#808080',
			48:'#b8b8b8',
			49:'#ccac93'
		},

		syncToken: "*", // Allows for optimized performance by ensuring an update procedure only runs if server returns new data. Can be disabled by setting to empty string

		//This has been designed to use the Todoist Sync API.
		apiVersion: "v9",
		apiBase: "https://todoist.com/API",
		todoistEndpoint: "sync",
		todoistEndpointCompleted: "completed/get_all",

		todoistResourceType: "[\"items\", \"projects\", \"collaborators\", \"user\", \"labels\", \"completed_info\", \"user_plan_limits\", \"stats\"]",

		debug: false
	},

	// Define required scripts.
	getStyles: function () {
		return ["MMM-Todoist.css"];
	},
	getTranslations: function () {
		return {
			en: "translations/en.json",
			de: "translations/de.json",
			nb: "translations/nb.json"
		};
	},

	start: function () {
		var self = this;
		Log.info("Starting module: " + this.name);

		this.updateIntervalID = 0; // Definition of the IntervalID to be able to stop and start it again
		this.ModuleToDoIstHidden = false; // by default it is considered displayed. Note : core function "this.hidden" has strange behaviour, so not used here
		this.externalModulesConfig = {};
		this.broadCastTaskPayload = null;

		//to display "Loading..." at start-up
		this.title = "Loading...";
		this.loaded = false;

		//Support legacy properties
		if (this.config.lists !== undefined) {
			if (this.config.lists.length > 0) {
				this.config.projects = this.config.lists;
			}
		}
		// Unify project config
		this.initProjectConfig();
		this.tasks = {
			items: [],
			projects: [],
			collaborators: [],
		};

		if (this.config.broadcastMode !== "receive" &&
			(!this.config.accessToken || this.config.accessToken === "")) {
			Log.error("MMM-Todoist: AccessToken not set and broadcast mode is " + this.config.broadcastMode + "!");
			return;
		}

		// keep track of user's projects list (used to build the "whitelist")
		this.userList = typeof this.config.projects !== "undefined" ?
			JSON.parse(JSON.stringify(this.config.projects)) : [];
		// We only do broadcast when all modules are started. Rx does not start at all
		if(this.config.broadcastMode === "none")
		{
			this.fetchAndSetUpdate()
		}
	},

	initProjectConfig: function ()
	{
		var self = this;
		if(this.config.projects.length > 0)
		{
			tmpNewProject = [];
			this.config.projects.forEach(project => {
				if(typeof project !== 'object')
				{
					tmpNewProject.push({project: project, sections: [], isDissallowed: self.config.blacklistProjects});
				}
				else
				{
					if(project.sections === undefined)
					{
						project.sections = [];
						if(project.isDissallowed === undefined)
						{
							project.isDissallowed = self.config.blacklistProjects;
						}
					}
					if(project.isDissallowed === undefined)
					{
						project.isDissallowed = false;
					}
				}
			});
			if(tmpNewProject.length > 0)
				this.config.projects = tmpNewProject;
		}
	},
	suspend: function () { //called by core system when the module is not displayed anymore on the screen
		this.ModuleToDoIstHidden = true;
		//Log.log("Fct suspend - ModuleHidden = " + ModuleHidden);
		this.GestionUpdateIntervalToDoIst();
	},

	resume: function () { //called by core system when the module is displayed on the screen
		this.ModuleToDoIstHidden = false;
		//Log.log("Fct resume - ModuleHidden = " + ModuleHidden);
		this.GestionUpdateIntervalToDoIst();
	},
	fetchAndSetUpdate: function() 
	{
		var self = this;
		if(this.updateIntervalID == 0)
		{
			this.sendSocketNotification("FETCH_TODOIST", this.config);

			//add ID to the setInterval function to be able to stop it later on
			this.updateIntervalID = setInterval(function () {
				self.sendSocketNotification("FETCH_TODOIST", self.config);
			}, this.config.updateInterval);
		}
	},
	notificationReceived: function (notification, payload) {
		var self = this;
		if (notification === "USER_PRESENCE") { // notification sended by module MMM-PIR-Sensor. See its doc
			//Log.log("Fct notificationReceived USER_PRESENCE - payload = " + payload);
			UserPresence = payload;
			this.GestionUpdateIntervalToDoIst();
		}  else if(notification === "TODOIST_BROADCAST")
		{
			if(this.config.broadcastMode == "receive")
			{
				// User can configure a specific access token to listen to in case we have multiple broadcasters
				if(this.config.accessToken != undefined ){ if(this.config.accessToken !== "" &&
					payload.tasksPayload.accessToken !== this.config.accessToken) { return; }}
				this.filterTodoistData(payload.tasksPayload);

				if (this.config.displayLastUpdate) {
					this.lastUpdate = Date.now() / 1000; //save the timestamp of the last update to be able to display it
					if(this.config.debug)
					{
						Log.log("ToDoIst received broadcast update OK, project : " + this.config.projects + " at : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat)); //AgP
					}
				}
				if(payload.completedPayload != null)
				{
					this.parseCompletedTasks(payload.completedPayload);
				}
				this.sort();
				this.loaded = true;
				this.updateDom();	
			}
		}
		else if (notification === "ALL_MODULES_STARTED")
		{
			if(this.config.broadcastMode === "broadcast")
			{
				var anyConfigUpdated = false;
				MM.getModules().withClass("MMM-Todoist").forEach(todoist => {
					if(todoist.identifier !== self.identifier)
					{
						if(todoist.config.maksCompletedAgeDays > self.config.maksCompletedAgeDays)
						{
							if(self.externalModulesConfig.maksCompletedAgeDays)
							{
								if(self.externalModulesConfig.maksCompletedAgeDays > todoist.config.maksCompletedAgeDays)
								{
									self.externalModulesConfig.maksCompletedAgeDays = todoist.config.maksCompletedAgeDays;
									anyConfigUpdated = true;
								}
							}
							else
							{
								self.externalModulesConfig.maksCompletedAgeDays = todoist.config.maksCompletedAgeDays;
								anyConfigUpdated = true;
							}
						}
					}
				});
				if(anyConfigUpdated)
				{
					this.fetchAndSetUpdate();
				}
			}
		}
	},

	GestionUpdateIntervalToDoIst: function () {
		if (UserPresence === true && this.ModuleToDoIstHidden === false) {
			var self = this;

			if(this.config.broadcastMode === "none" || this.config.broadcastMode === "broadcast")
			{
				this.fetchAndSetUpdate();
			}

		} else { //if (UserPresence = false OR ModuleHidden = true)
			Log.log("Personne regarde : on stop l'update " + this.name + " projet : " + this.config.projects);
			clearInterval(this.updateIntervalID); // stop the update interval of this module
			this.updateIntervalID = 0; //reset the flag to be able to start another one at resume
		}
	},

	// Code from MichMich from default module Calendar : to manage task displayed on several lines
	/**
	 * Shortens a string if it's longer than maxLength and add a ellipsis to the end
	 *
	 * @param {string} string Text string to shorten
	 * @param {number} maxLength The max length of the string
	 * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
	 * @returns {string} The shortened string
	 */
	shorten: function (string, maxLength, wrapEvents) {
		if (typeof string !== "string") {
			return "";
		}

		if (wrapEvents === true) {
			var temp = "";
			var currentLine = "";
			var words = string.split(" ");

			for (var i = 0; i < words.length; i++) {
				var word = words[i];
				if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) { // max - 1 to account for a space
					currentLine += (word + " ");
				} else {
					if (currentLine.length > 0) {
						temp += (currentLine + "<br>" + word + " ");
					} else {
						temp += (word + "<br>");
					}
					currentLine = "";
				}
			}

			return (temp + currentLine).trim();
		} else {
			if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
				return string.trim().slice(0, maxLength) + "&hellip;";
			} else {
				return string.trim();
			}
		}
	},
	//end modif AgP

	// Override socket notification handler.
	// ******** Data sent from the Backend helper. This is the data from the Todoist API ************
	socketNotificationReceived: function (notification, payload) {
		if (notification === "TASKS") {
			this.config.syncToken = payload.sync_token;
			// This is a minor optimisation that allows us to brroadcast data before working on the local filtering in case we do not run the CHECK_COMPLETED
			requestCheckCompleted = false;
			if(payload.full_sync)
			{
				if(this.config.displayCompleted)
				{
					// Since we do partial sync, we should only assume new completed tasks if sync token changes and thus completed tasks does as well
					// TODO: Check what happens in case we 
					if(payload.user_plan_limits.current != undefined &&
						payload.user_plan_limits.current.completed_tasks && 
						payload.items.length > 0)
					{
						requestCheckCompleted = true;
					}
					else
					{
						if(payload.user_plan_limits.current != undefined &&
							!payload.user_plan_limits.current.completed_tasks)
						{
							Log.error("Todoist Error. Users plan does not allow to check for completed items: " + payload.user_plan_limits.current.plan_name);
						}
					}
				}
			}
			if(this.config.broadcastMode === "broadcast")
			{
				if(!requestCheckCompleted)
				{
					this.sendNotification("TODOIST_BROADCAST", {sender: this.identifier, tasksPayload: payload,  completedPayload: null});
				}
				else
				{
					this.broadCastTaskPayload = payload;
				}
			}
			this.filterTodoistData(payload);

			if (this.config.displayLastUpdate) {
				this.lastUpdate = Date.now() / 1000; //save the timestamp of the last update to be able to display it
				Log.log("ToDoIst update OK, project : " + this.config.projects + " at : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat)); //AgP
			}
			if(requestCheckCompleted)
			{
				this.sendSocketNotification("CHECK_COMPLETED", this.config);
				return;
			}
			this.sort();
			this.loaded = true;
			this.updateDom();
		}
		else if(notification === "TASKS_INC_COMPLETED")
		{
			if(this.config.broadcastMode === "broadcast")
			{
				//Log.log("MMM-Todoist broadcasting information");
				this.sendNotification("TODOIST_BROADCAST", {sender: this.identifier, tasksPayload: this.broadCastTaskPayload,  completedPayload: payload});
				this.broadCastTaskPayload = null;
			}
			this.parseCompletedTasks(payload);
			this.sort();
			this.loaded = true;
			this.updateDom();
		} else if (notification === "FETCH_ERROR") {
			Log.error("Todoist Error. Could not fetch todos: " + payload.error);
		}
	},
	filterTodoistData: function (tasks) {
		var self = this;
		var labelIds = [];

		if (tasks == undefined) {
			return;
		}
		if (this.config.broadcastMode !== "receive" && tasks.accessToken != self.config.accessToken) {
			return;
		}
		if (tasks.items == undefined) {
			return;
		}
		if(this.tasks.items == undefined)
		{
			return;
		}

		if (this.config.blacklistProjects) {
			// take all projects in payload, and remove the ones specified by user
			// i.e., convert user's "whitelist" into a "blacklist"
			this.config.projects = [];
			tasks.projects.forEach(project => {
				if(self.userList.includes(project.id)) {
					return; // blacklisted
				}
				self.config.projects.push(project.id);
			});
			if(self.config.debug) {
				console.log("MMM-Todoist: original list of projects was blacklisted.\n" +
					"Only considering the following projects:");
				console.log(this.config.projects);
			}
		}
		var items = self.filterByLabelAndProject(tasks);

		// Used for ordering by date
		items.forEach(function (item) {
			self.sanitizeDate(item);
		});

		if (!tasks.full_sync)
		{
			items = self.mergeAndUpdateItems(items, tasks.projects, tasks.collaborators);
		}
		else
		{
			items = self.replaceAllItems(items, tasks.projects, tasks.collaborators);
		}

		/* Not needed for labels, but kept for reuse elsewhere
		// Loop through labels fetched from API and find corresponding label IDs for task filtering
		// Could be re-used for project names -> project IDs.
		if (self.config.labels.length>0 && tasks.labels != undefined) {
			for (let apiLabel of tasks.labels) {
				for (let configLabelName of self.config.labels) {
					if (apiLabel.name == configLabelName) {
						labelIds.push(apiLabel.id);
						break;
					}
				}
			}
		}
		*/
		// We rely on the fact that a parent due date should always be later than any childs
		if (self.config.displayTasksWithinDays > -1 || !self.config.displayTasksWithoutDue)
		{
			items.filter(function(item) {
				if(item.parent.due === null)
				{
					if(!self.config.displayTasksWithoutDue)
					{
						return false;
					}
				}
				else
				{
					return self.taskIsDue(item.parent.due.date, self.config.displayTasksWithinDays)
				}
			});
		}
		// If MM has run for a long time and some (sub) tasks are to be removed as they have passed the expiration date
		self.filterCompletedByAge(items);

		//**** FOR DEBUGGING TO HELP PEOPLE GET THEIR PROJECT IDs */
		if (self.config.debug) {
			console.log("%c *** PROJECT -- ID ***", "background: #222; color: #bada55");
			tasks.projects.forEach(project => {
				console.log("%c" + project.name + " -- " + project.id, "background: #222; color: #bada55");
			});
		};
	},
	filterByLabelAndProject: function(tasks)
	{
		var self = this;
		items= [];
		// Filter the Todos by the criteria specified in the Config
		// We assume that children will inherit their parents label/project
		// If we have only excluded projects, then we can include all projects not defined
		// Sorry for this part, I cannot make the correct one liner ^^
		var onlyDissallowedProjects = true;
		this.config.projects.forEach(projectDef => {
			if(!projectDef.isDissallowed && projectDef.sections.length === 0) { onlyDissallowedProjects = false; }
			else if(projectDef.isDissallowed && projectDef.sections > 0) { onlyDissallowedProjects = false; }
		});
		tasks.items.forEach(function (item) {
			// Ignore sub-tasks
			if (item.parent_id!=null && !self.config.displaySubtasks) { return; }

			// Filter using label if a label is configured
			if (self.config.labels.length > 0 && item.labels.length > 0) {
        			// Check all the labels assigned to the task. Add to items if match with configured label
        			for (let label of item.labels) {
          				for (let labelName of self.config.labels) {
            					if (label == labelName) { //the string returned from SyncAPI matches the strong in config
              						items.push(item);
              						return;
            					}
          				}
        			}
      			}
			var projectDef = self.config.projects.find(sectionDef => sectionDef.project == item.project_id);
			if(projectDef != undefined)
			{
				if(projectDef.sections.length > 0)
				{
					if(item.section_id == null)
					{
						if(projectDef.sections.includes("") && !projectDef.isDissallowed)
						{
							items.push(item);
						}
					}
					else
					{
						if(projectDef.sections.includes(item.section_id))
						{
							if(!projectDef.isDissallowed)
							{
								items.push(item);
							}
						}
						else if (projectDef.isDissallowed)
						{
							items.push(item);
						}
					}
				}
				else
				{
					if(!projectDef.isDissallowed)
					{						
						items.push(item);
					}
				}
			}
			else if(onlyDissallowedProjects)
			{				
				items.push(item);
			}
		});
		return items;
	},
	replaceAllItems: function(items, projects, collaborators)
	{
		var self = this;
		self.tasks.items = [];
		self.tasks.projects = projects;
		self.collaborators = collaborators;
		items.forEach(item => {
			if(item.parent_id == null || (self.config.sortTypeStrict && self.config.displaySubtasks))
			{
				self.tasks.items.push({parent: item, children: []});
			}
			else
			{
				var index = self.tasks.items.findIndex(childToCheck => childToCheck.parent.id == item.parent_id)
				if(index != -1)
				{
					self.tasks.items[index].children.push(item);
				}
				else
				{
					Log.error("Unhandled case; full sync item is not a parent and has no matching parent id - item not conisdered");
				}
			}
		});
		return self.tasks.items;
	},
	mergeAndUpdateItems: function(items, projects, collaborators)
	{
		var self = this;
		projects.forEach(project => {
			if(!self.tasks.projects.includes(projectIte => {projectIte.id == project.id}))
			{
				self.tasks.projects.push(project);
			}
		});
		collaborators.forEach(collaborator => {
			if(!self.tasks.collaborators.includes(collaboratorIte => {collaboratorIte.id == collaborator.id}))
			{
				self.tasks.collaborators.push(collaborator);
			}
		});
		// Remove/insert potential completed/uncompleted tasks
		items.forEach(item => {
			var idToCheck = item.id;
			if(item.parent_id != null && !self.config.sortTypeStrict)
			{
				idToCheck = item.parent_id;
			}
			var index = self.tasks.items.findIndex(itemToCheck => itemToCheck.parent.id == idToCheck);
			if(index != -1)
			{
				if(item.parent_id == null || self.config.sortTypeStrict)
				{
					if(item.is_deleted)
					{
						self.tasks.items.splice(index, 1);
					}
					else
					{
						self.tasks.items[index].parent = item;
					}
				}
				else
				{
					var subIndex = self.tasks.items[index].children.findIndex(itemToCheck => itemToCheck.id == item.id);
					if(subIndex != -1)
					{
						if(item.is_deleted)
						{
							self.tasks.items[index].children.splice(subIndex, 1);
						}
						else
						{
							self.tasks.items[index].children[subIndex] = item;
						}
					}
					else
					{
						self.tasks.items[index].children.push(item);
					}
				}
			}
			else
			{
				if((item.parent_id == null || (self.config.sortTypeStrict && self.config.displaySubtasks)) && !item.is_deleted)
				{
					self.tasks.items.push({parent: item, children: []});
				}
				else
				{
					Log.error("Unhandled case; updated item is not a parent and has no matching parent id - item not conisdered");
				}
			}
		});
		return self.tasks.items;
	},
	filterCompletedByAge: function(items)
	{
		var self = this;
		items.filter(function(item){
			if(item.parent.completed_at != null)
			{
				return self.taskIsDue(self.parseDueDate(item.parent.completed_at), self.config.maksCompletedAgeDays);
			}
			else
			{
				return true;
			}
		});
		if(self.config.displaySubtasks)
		{
			items.forEach(item => {
				if(item.children.length > 0)
				{
					item.children.filter(function(item){
						if(item.completed_at != null)
						{
							return self.taskIsDue(self.parseDueDate(item.completed_at), self.config.maksCompletedAgeDays);
						}
						else
						{
							return true;
						}
					});
				}
			});
		}
	},
	taskIsDue: function(date, daysBack)
	{
		var self = this;
		var oneDay = 24 * 60 * 60 * 1000;
		var dueDateTime = date;//self.parseDueDate(date);
		var dueDate = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth(), dueDateTime.getDate());
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		var diffDays = Math.floor((dueDate - today) / (oneDay));
		return diffDays <= daysBack;
	},
	sort: function()
	{
		var self = this;
		//***** Sorting code if you want to add new methods. */
		switch (self.config.sortType) {
			case "todoist":
				self.sortByTodoist();
				break;
			case 'priority':
				self.sortByPriority();
				break;
			case "dueDateAsc":
				self.sortByDueDateAsc();
				break;
			case "dueDateDesc":
				self.sortByDueDateDesc();
				break;
			case "dueDateDescPriority":
				self.sortByDueDateDescPriority();
				break;
			case "todoistAndDue":
				self.sortByTodoistPrioritiseDue();
				break;
			default:
				self.sortByTodoist();
				break;
			}
	},
	parseCompletedTasks: function(completedTasks)
	{ 
		var self = this;
		var itemsNoParent = [];
		var labelIds = [];
		if (completedTasks == undefined) {
			return;
		}
		if (this.config.broadcastMode !== "receive" && completedTasks.accessToken != self.config.accessToken) {
			return;
		}
		if (completedTasks.items == undefined) {
			return;
		}
		// TODO: DO we want to include fully completed projects etc?
		if(this.tasks != undefined)
		{
			completedTasks.items.forEach(function (item)
			{
				if(item.item_object == undefined) { return; }
				if(!self.isProjectInConfig(item.item_object.project_id) &&
					!self.isLabelInConfig(item.item_object.labels)) { return; }
				if(!self.config.displaySubtasks && item.item_object.parent_id != null) { return; }

				if (item.item_object.parent_id != null && !self.config.sortTypeStrict)
				{
					var parentIndex = self.tasks.items.findIndex(itemToCheck => itemToCheck.parent.id == item.item_object.parent_id);
					if(parentIndex != -1)
					{
						var childIndex = self.tasks.items[parentIndex].children.findIndex(childToCheck => childToCheck.id == item.item_object.id);
						if(childIndex != -1)
						{
							self.sanitizeDate(item.item_object);
							self.tasks.items[parentIndex].children[childIndex] = item.item_object;
						}
						else
						{
							self.sanitizeDate(item.item_object);
							self.tasks.items[parentIndex].children.push(item.item_object);
						}
					}
					else
					{
						Log.error("Unhandled case; completed item is not a parent and has no matching parent id - item not conisdered");
					}
				}
				else
				{
					var index = self.tasks.items.findIndex(itemToCheck => itemToCheck.parent.id == item.item_object.id);
					if(index != -1)
					{
						self.sanitizeDate(item.item_object);
						self.tasks.items[index].parent = item.item_object;
					}
					else
					{
						// We always have completed at the end of the list
						self.sanitizeDate(item.item_object);
						self.tasks.items.push({parent: item.item_object, children: []});	
					}
				}
			});
		}
	},
	isProjectInConfig: function(projectToCheck)
	{
		return (this.config.projects.find(project => projectToCheck == project) != undefined);
	},
	isLabelInConfig: function(labelsToCheck)
	{
		var returnValue = false;
		if(this.config.labels.length == 0) { return false; }
		this.config.labels.forEach(function(label)
		{
			if(labelsToCheck.find(labelToCheck => label == labelToCheck) != undefined) { returnValue = true; return; }
		});
		return returnValue;
	},
	/*
	 * The Todoist API returns task due dates as strings in these two formats: YYYY-MM-DD and YYYY-MM-DDThh:mm:ss
	 * This depends on whether a task only has a due day or a due day and time. You cannot pass this date string into
	 * "new Date()" - it is inconsistent. In one format, the date string is considered to be in UTC, the other in the
	 * local timezone. Additionally, if the task's due date has a timezone set, it is given in UTC (zulu format),
	 * otherwise it is local time. The parseDueDate function keeps Dates consistent by interpreting them all relative
	 * to the same timezone.
	 */
	sanitizeDate: function(item)
	{
		if (item.due === null) {
			item.due = {};
			item.due["date"] = "2100-12-31";
			item.all_day = true;
		}
		// Used to sort by date.
		item.date = this.parseDueDate(item.due.date);

		// as v8 API does not have 'all_day' field anymore then check due.date for presence of time
		// if due.date has a time then set item.all_day to false else all_day is true
		if (item.due.date.length > 10) {
			item.all_day = false;
		} else {
			item.all_day = true;
		}
	},

	parseDueDate: function (date) {
		let [year, month, day, hour = 0, minute = 0, second = 0] = date.split(/\D/).map(Number);

		// If the task's due date has a timezone set (as opposed to the default floating timezone), it's given in UTC time.
		if (date[date.length -1] === "Z") {
			return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
		}

		return new Date(year, month - 1, day, hour, minute, second);
	},
	sortByTodoist: function () {
		self = this;

		self.tasks.items.sort(function (a, b) {
				return a.parent.id - b.parent.id;
		});

		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function(a, b) {
					
					if(!a.completed && !b.completed)
					{
						return a.id - b.id;
					}
					else if(a.completed && b.completed)
					{
						return a.id - b.id;
					}
					else if(a.completed && !b.completed)
					{
						return 1
					}
					else if(!a.completed && b.completed)
					{
						return -1
					}
				});
			}
		});
	},
	sortByTodoistPrioritiseDue: function()
	{
		self = this;

		self.tasks.items.sort(function (a, b) {
			if(a.parent.priority != b.parent.priority)
			{
				return b.parent.priority - a.parent.priority;
			}
			else if(a.parent.date != null && b.parent.date != null)
			{
				return a.parent.date - b.parent.date;
			}
			else if(a.parent.date == b.parent.date)
			{
				return a.parent.id - b.parent.id;
			}
			// I don't think the below will ever happen
			else if(a.parent.date == null && b.parent.date == null)
			{
				return a.parent.id - b.parent.id;
			}
			else if(a.parent.date != null && b.parent.date == null)
			{
				return -1;
			}
			else if(a.parent.date == null && b.parent.date != null)
			{
				return 1;
			}
			else
			{
				return -1
			}
		});

		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function(a, b) {
					
					if(a.priority != b.priority)
					{
						return b.priority - a.priority;
					}
					else if(a.date != null && b.date != null)
					{
						return a.date - b.date;
					}
					else if(a.date == b.date)
					{
						return a.id - b.id;
					}
				});
			}
		});
	},
	sortByDueDateAsc: function () {
		self.tasks.items.sort(function (a, b) {
			return a.parent.date - b.parent.date;
		});
		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function (a, b) {
					return a.date - b.date;
				});
			}
		});
	},
	sortByDueDateDesc: function () {
		self.tasks.items.sort(function (a, b) {
			return b.parent.date - a.parent.date;
		});
		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function (a, b) {
					return b.date - a.date;
				});
			}
		});
	},
	sortByPriority: function () {
		self.tasks.items.sort(function (a, b) {
			return b.parent.priority - a.parent.priority;
		});
		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function (a, b) {
					return b.priority - a.priority;
				});
			}
		});
	},
	sortByDueDateDescPriority: function () {
		self.tasks.items.sort(function (a, b) {
			if (a.parent.date > b.parent.date) return 1;
			if (a.parent.date < b.parent.date) return -1;

			if (a.parent.priority < b.parent.priority) return 1;
			if (a.parent.priority > b.parent.priority) return -1;
		});
		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function (a, b) {
					if (a.date > b.date) return 1;
					if (a.date < b.date) return -1;
		
					if (a.priority < b.priority) return 1;
					if (a.priority > b.priority) return -1;
				});
			}
		});
	},
	sortByCreatedDate: function () {
		self.tasks.items.sort(function (a, b) {
			return b.parent.priority - a.parent.priority;
		});
		self.tasks.items.forEach(item => {
			if(item.children.length > 0)
			{
				item.children.sort(function (a, b) {
					return b.priority - a.priority;
				});
			}
		});
	},
	createCell: function(className, innerHTML) {
		var cell = document.createElement("div");
		cell.className = "divTableCell " + className;
		cell.innerHTML = innerHTML;
		return cell;
	},
	addPriorityIndicatorCell: function(item) {
		var className = "priority ";
		switch (item.priority) {
			case 4:
				className += "priority1";
				break;
			case 3:
				className += "priority2";
				break;
			case 2:
				className += "priority3";
				break;
			default:
				className = "";
				break;
		}
		return this.createCell(className, "&nbsp;");
	},
	addColumnSpacerCell: function() {
		return this.createCell("spacerCell", "&nbsp;");
	},
	addTodoTextCell: function(item, maxDueDateCellLength, maxProjectCellLength) {
		var temp = document.createElement('div');
		temp.innerHTML = item.contentHtml;

		var para = temp.getElementsByTagName('p');
		var taskText = para[0].innerHTML;

		var cellClasses = "title bright alignLeft";
		var antiWrapSubtraction = 0;
		// if sorting by todoist, indent subtasks under their parents
		if (!this.config.sortTypeStrict && item.parent_id) {
			// this item is a subtask so indent it
			taskText = '- ' + taskText;
			antiWrapSubtraction += 2;
		}
		
		if(item.checked)
		{
			cellClasses += " todoCompleted";
			antiWrapSubtraction += 1;
		}

		if(item.dueDateContentHTML != "")
		{
			antiWrapSubtraction += maxDueDateCellLength;
		}
		if (this.config.showProject) {
			// TODO: Fix this hardcoding to actual measurements
			if(this.config.maxProjectLength < maxProjectCellLength && this.config.maxProjectLength != 0)
			{
				antiWrapSubtraction += this.config.maxProjectLength + 4;
			}
			else
			{
				antiWrapSubtraction += maxProjectCellLength + 4;
			}
		}
		return this.createCell(cellClasses, 
			this.shorten(taskText, (this.config.maxTitleLength - antiWrapSubtraction), this.config.wrapEvents));

		// return this.createCell("title bright alignLeft", item.content);
	},
	addDueDateCell: function(item) {
		return this.createCell(item.dueDateContentHTML.className, item.dueDateContentHTML.innerHTML);
	},
	prepareDueDateCell: function(item)
	{
		var innerHTML = "";
		var className = "bright align-right dueDate ";

		var oneDay = 24 * 60 * 60 * 1000;
		var dueDateTime = this.parseDueDate(item.due.date);
		var dueDate = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth(), dueDateTime.getDate());
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		var diffDays = Math.floor((dueDate - today) / (oneDay));
		var diffMonths = (dueDate.getFullYear() * 12 + dueDate.getMonth()) - (now.getFullYear() * 12 + now.getMonth());

		if (diffDays < -1) {
			innerHTML = dueDate.toLocaleDateString(config.language, {
												"month": "short"
											}) + " " + dueDate.getDate();
			className += "xsmall overdue";
		} else if (diffDays === -1) {
			innerHTML = this.translate("YESTERDAY");
			className += "xsmall overdue";
		} else if (diffDays === 0) {
			innerHTML = this.translate("TODAY");
			if (item.all_day || dueDateTime >= now) {
				className += "today";
			} else {
				className += "overdue";
			}
		} else if (diffDays === 1) {
			innerHTML = this.translate("TOMORROW");
			className += "xsmall tomorrow";
		} else if (diffDays < 7) {
			innerHTML = dueDate.toLocaleDateString(config.language, {
				"weekday": "short"
			});
			className += "xsmall";
		} else if (diffMonths < 7 || dueDate.getFullYear() == now.getFullYear()) {
			innerHTML = dueDate.toLocaleDateString(config.language, {
				"month": "short"
			}) + " " + dueDate.getDate();
			className += "xsmall";
		} else if (item.due.date === "2100-12-31") {
			innerHTML = "";
			className += "xsmall";
		} else {
			innerHTML = dueDate.toLocaleDateString(config.language, {
				"month": "short"
			}) + " " + dueDate.getDate() + " " + dueDate.getFullYear();
			className += "xsmall";
		}
		if (innerHTML !== "" && !item.all_day) {
			function formatTime(d) {
				function z(n) {
					return (n < 10 ? "0" : "") + n;
				}
				var h = d.getHours();
				var m = z(d.getMinutes());
				if (config.timeFormat == 12) {
					return " " + (h % 12 || 12) + ":" + m + (h < 12 ? " AM" : " PM");
				} else {
					return " " + h + ":" + m;
				}
			}
			innerHTML += formatTime(dueDateTime);
		}
		return {innerHTML: innerHTML, className: className};
	},
	findProject: function(item)
	{
		return this.tasks.projects.find(p => p.id === item.project_id);
	},
	addProjectCell: function(project) {
		var projectcolor = this.config.projectColors[project.color];
		var projectName = project.name;
		if(this.config.maxProjectLength != 0 && projectName.length > this.config.maxProjectLength)
		{
			projectName = projectName.slice(0, this.config.maxProjectLength);
		}
		var innerHTML = "<span class='projectcolor' style='color: " + projectcolor + "; background-color: " + projectcolor + "'></span>" + projectName;
		return this.createCell("xsmall", innerHTML);
	},
	addAssigneeAvatorCell: function(item, collaboratorsMap) {	
		var avatarImg = document.createElement("img");
		avatarImg.className = "todoAvatarImg";

		var colIndex = collaboratorsMap.get(item.responsible_uid);
		if (typeof colIndex !== "undefined" && this.tasks.collaborators[colIndex].image_id!=null) {
			avatarImg.src = "https://dcff1xvirvpfp.cloudfront.net/" + this.tasks.collaborators[colIndex].image_id + "_big.jpg";
		} else { avatarImg.src = "/modules/MMM-Todoist/1x1px.png"; }

		var cell = this.createCell("", "");
		cell.appendChild(avatarImg);

		return cell;
	},
	createRow: function(item, collaboratorsMap, maxDueDateCellLength, maxProjectCellLength)
	{
		var divRow = document.createElement("div");
		//Add the Row
		divRow.className = "divTableRow";
		//Columns
		divRow.appendChild(this.addPriorityIndicatorCell(item));
		divRow.appendChild(this.addColumnSpacerCell());
		divRow.appendChild(this.addTodoTextCell(item, maxDueDateCellLength, maxProjectCellLength));
		divRow.appendChild(this.addDueDateCell(item));
		if (this.config.showProject) {
			divRow.appendChild(this.addColumnSpacerCell());
			divRow.appendChild(this.addProjectCell(item.project));
		}
		if (this.config.displayAvatar) {
			divRow.appendChild(this.addAssigneeAvatorCell(item, collaboratorsMap));
		}
		return divRow;
	},
	getDom: function () {
		var self = this;
		if (this.config.hideWhenEmpty && this.tasks.items.length===0) {
			return null;
		}

		//Slice by max Entries is done here for simplicity
		var truncatedItems = this.truncateItems();

		//Add a new div to be able to display the update time alone after all the task
		var wrapper = document.createElement("div");

		//display "loading..." if not loaded
		if (!this.loaded) {
			wrapper.innerHTML = "Loading...";
			wrapper.className = "dimmed light small";
			return wrapper;
		}


		//New CSS based Table
		var divTable = document.createElement("div");
		divTable.className = "divTable normal small light";

		var divBody = document.createElement("div");
		divBody.className = "divTableBody";
		
		if (this.tasks === undefined) {
			return wrapper;
		}

		// create mapping from user id to collaborator index
		var collaboratorsMap = new Map();

		for (var value=0; value < this.tasks.collaborators.length; value++) {
			collaboratorsMap.set(this.tasks.collaborators[value].id, value);
		}

		var prevProjectName = "Unknown";
		//Iterate through Todos
		truncatedItems.itemsToDisplay.forEach(item => {
			if(item.parent == null) { return; }
			// Dispaly parent row
			divBody.appendChild(self.createRow(item.parent, collaboratorsMap, truncatedItems.maxDueDateCellLength, truncatedItems.maxProjectCellLength));
			//Display nested children in separate rows
			item.children.forEach(childItem =>{
				if(childItem == null){ return; }
				divBody.appendChild(divBody.appendChild(self.createRow(childItem, collaboratorsMap, truncatedItems.maxDueDateCellLength, truncatedItems.maxProjectCellLength)));
			});
		});
		
		divTable.appendChild(divBody);
		wrapper.appendChild(divTable);

		// create the gradient
		if (this.config.fade && this.config.fadePoint < 1) divTable.querySelectorAll('.divTableRow').forEach((row, i, rows) => row.style.opacity = Math.max(0, Math.min(1 - ((((i + 1) * (1 / (rows.length))) - this.config.fadePoint) / (1 - this.config.fadePoint)) * (1 - this.config.fadeMinimumOpacity), 1)));

		// display the update time at the end, if defined so by the user config
		if (this.config.displayLastUpdate) {
			var updateinfo = document.createElement("div");
			updateinfo.className = "xsmall light align-left";
			updateinfo.innerHTML = "Update : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat);
			wrapper.appendChild(updateinfo);
		}

		//**** FOR DEBUGGING TO HELP PEOPLE GET THEIR PROJECT IDs - (People who can't see console) */
		if (this.config.debug) {
			var projectsids = document.createElement("div");
			projectsids.className = "xsmall light align-left";
			projectsids.innerHTML = "<span>*** PROJECT -- ID ***</span><br />";
			this.tasks.projects.forEach(project => {
				projectsids.innerHTML += "<span>" + project.name + " -- " + project.id + "</span><br />";
			});
			wrapper.appendChild(projectsids);
		};
		//****** */

		return wrapper;
	},
	truncateItems: function()
	{
		var self = this;
		var maximumEntries = this.config.maximumEntries;
		if(maximumEntries == 0)
		{
			maximumEntries = 256;
		}
		var displayCompleted = this.config.displayCompleted;
		var deprioritizeCompleted = this.config.deprioritizeCompleted;
		var retVal = {itemsToDisplay: [], maxDueDateCellLength: 0, maxProjectCellLength: 0};
		var itemsCount = 0;
		for(let ii = 0; ii < this.tasks.items.length; ii++)
		{
			item = this.tasks.items[ii];
			if(itemsCount >= maximumEntries)
			{
				return retVal;
			}
			item.parent.dueDateContentHTML = self.prepareDueDateCell(item.parent);
			item.parent.project = self.findProject(item.parent);
			if(item.parent.dueDateContentHTML.innerHTML.length > retVal.maxDueDateCellLength)
			{
				retVal.maxDueDateCellLength = item.parent.dueDateContentHTML.innerHTML.length;
			}
			if((item.parent.project.name).length > retVal.maxDueDateCellLength)
			{
				retVal.maxProjectCellLength = (item.parent.project.name).length;
			}
			// TODO why is a parent null???
			//if(item.parent === undefined) {return;}
			if(!item.parent.checked)
			{
				retVal.itemsToDisplay.push({parent: item.parent, children: []});
				itemsCount++;
				for(let jj = 0; jj < item.children.length; jj++)
				{
					itemChild = item.children[jj];
					if(itemsCount >= maximumEntries)
					{
						return retVal;
					}
					itemChild.dueDateContentHTML = self.prepareDueDateCell(itemChild);
					itemChild.project = self.findProject(item.parent);
					if(itemChild.dueDateContentHTML.innerHTML.length > retVal.maxDueDateCellLength)
					{
						retVal.maxDueDateCellLength = itemChild.dueDateContentHTML.innerHTML.length;
					}
					if((itemChild.project.name).length > retVal.maxDueDateCellLength)
					{
						retVal.maxProjectCellLength = (itemChild.project.name).length;
					}
					if(!itemChild.checked)
					{
						retVal.itemsToDisplay[ii].children.push(itemChild);
						itemsCount++;
					}
					else
					{
						if(deprioritizeCompleted)
						{
							retVal.itemsToDisplay[ii].children.push(null);
						}
						else
						{
							retVal.itemsToDisplay[ii].children.push(itemChild);
							itemsCount++;
						}
					}
				}
			}
			else if(displayCompleted)
			{
				if(deprioritizeCompleted)
				{
					retVal.itemsToDisplay.push({parent: null, children: []});	
				}
				else
				{
					retVal.itemsToDisplay.push({parent: item.parent, children: []});	
					itemsCount++;
				}
			}
		}
		if(deprioritizeCompleted && displayCompleted)
		{
			for(let ii = 0; ii < retVal.itemsToDisplay.length; ii++)
			{
				if(itemsCount >= maximumEntries)
				{
					return retVal;
				}
				if(retVal.itemsToDisplay[ii].parent == null)
				{
					retVal.itemsToDisplay[ii].parent = self.tasks.items[ii].parent;
					itemsCount++;
				}
				for(let jj = 0; jj < retVal.itemsToDisplay[ii].children.length; jj++)
				{
					if(itemsCount >= maximumEntries)
					{
						return retVal;
					}
					if(retVal.itemsToDisplay[ii].children[jj] == null)
					{
						retVal.itemsToDisplay[ii].children[jj] = self.tasks.items[ii].children[jj];
						itemsCount++;
					}
				}
			}
		}
		return retVal;
	},
	myProjectLog: function(stuff)
	{

		if(this.config.projects[0] == 2345550300)
		{
			Log.log(stuff);
		}
	}
});
