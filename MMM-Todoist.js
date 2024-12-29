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

		todoistResourceType: "[\"items\", \"projects\", \"collaborators\", \"user\", \"labels\", \"completed_info\", \"user_plan_limits\"]",

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

		//to display "Loading..." at start-up
		this.title = "Loading...";
		this.loaded = false;

		if (this.config.accessToken === "") {
			Log.error("MMM-Todoist: AccessToken not set!");
			return;
		}

		//Support legacy properties
		if (this.config.lists !== undefined) {
			if (this.config.lists.length > 0) {
				this.config.projects = this.config.lists;
			}
		}

		this.tasks = {
			"items": [],
			"projects": [],
			"collaborators": [],
		};

		// keep track of user's projects list (used to build the "whitelist")
		this.userList = typeof this.config.projects !== "undefined" ?
			JSON.parse(JSON.stringify(this.config.projects)) : [];

		this.sendSocketNotification("FETCH_TODOIST", this.config);

		//add ID to the setInterval function to be able to stop it later on
		this.updateIntervalID = setInterval(function () {
			self.sendSocketNotification("FETCH_TODOIST", self.config);
		}, this.config.updateInterval);
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

	notificationReceived: function (notification, payload) {
		if (notification === "USER_PRESENCE") { // notification sended by module MMM-PIR-Sensor. See its doc
			//Log.log("Fct notificationReceived USER_PRESENCE - payload = " + payload);
			UserPresence = payload;
			this.GestionUpdateIntervalToDoIst();
		}
	},

	GestionUpdateIntervalToDoIst: function () {
		if (UserPresence === true && this.ModuleToDoIstHidden === false) {
			var self = this;

			// update now
			this.sendSocketNotification("FETCH_TODOIST", this.config);

			//if no IntervalID defined, we set one again. This is to avoid several setInterval simultaneously
			if (this.updateIntervalID === 0) {

				this.updateIntervalID = setInterval(function () {
					self.sendSocketNotification("FETCH_TODOIST", self.config);
				}, this.config.updateInterval);
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
			this.filterTodoistData(payload);

			if (this.config.displayLastUpdate) {
				this.lastUpdate = Date.now() / 1000; //save the timestamp of the last update to be able to display it
				Log.log("ToDoIst update OK, project : " + this.config.projects + " at : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat)); //AgP
			}
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
						this.sendSocketNotification("CHECK_COMPLETED", this.config);
					}
					else
					{
						if(payload.user_plan_limits.current != undefined &&
							!payload.user_plan_limits.current.completed_tasks)
						{
							Log.error("Todoist Error. Users plan does not allow to check for completed items: " + payload.user_plan_limits.current.plan_name);
						}
						this.loaded = true;
						this.updateDom(1000);
					}
				}
				else
				{
					this.loaded = true;
					this.updateDom(1000);
				}
			}
			else
			{
				this.loaded = true;
				this.updateDom(1000);
			}
		}
		else if(notification === "TASKS_INC_COMPLETED")
		{
			this.parseCompletedTasks(payload);
			this.loaded = true;
			this.updateDom(1000);
		} else if (notification === "FETCH_ERROR") {
			Log.error("Todoist Error. Could not fetch todos: " + payload.error);
		}
	},
	filterTodoistData: function (tasks) {
		var self = this;
		var items = [];
		var labelIds = [];

		if (tasks == undefined) {
			return;
		}
		if (tasks.accessToken != self.config.accessToken) {
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
		items = self.filterByLabelAndProject(tasks, items);

		// Used for ordering by date
		items.forEach(function (item) {
			self.sanitizeDate(item);
		});

		// We just copy the old data to rerun the filtering even if nothing new is coming from the server
		// this should ensure that i.e. due dates will be updated even though no new tasks has been created
		if (!tasks.full_sync)
		{
			items = self.mergeAndUpdateItems(tasks, items);
		}
		else
		{
			items = self.replaceAllItems(tasks, items);
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

		//***** Sorting code if you want to add new methods. */
		switch (self.config.sortType) {
		case "todoist":
			self.tasks.items = self.sortByTodoist(items);
			break;
		case 'priority':
			self.tasks.items = self.sortByPriority(items);
			break;
		case "dueDateAsc":
			self.tasks.items = self.sortByDueDateAsc(items);
			break;
		case "dueDateDesc":
			self.tasks.items = self.sortByDueDateDesc(items);
			break;
		case "dueDateDescPriority":
			self.tasks.items = self.sortByDueDateDescPriority(items);
			break;
		default:
			self.tasks.items = self.sortByTodoist(items);
			break;
		}
	},
	filterByLabelAndProject: function(tasks, items)
	{
		var self = this;
		// Filter the Todos by the criteria specified in the Config
		// We assume that children will inherit their parents label/project
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

			// Filter using projets if projects are configured
			if (self.config.projects.length>0){
			  self.config.projects.forEach(function (project) {
			  		if (item.project_id == project) {
						items.push(item);
						return;
					}
			  });
			}
		});
		return items;
	},
	replaceAllItems: function(tasks, items)
	{
		var self = this;
		self.tasks.items = [];
		self.tasks.projects = tasks.projects;
		self.collaborators = tasks.collaborators;
		items.forEach(item => {
			if(item.parent_id == null)
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
	mergeAndUpdateItems: function(tasks, items)
	{
		var self = this;
		tasks.projects.forEach(project => {
			if(!self.tasks.projects.includes(projectIte => {projectIte.id == project.id}))
			{
				self.tasks.projects.push(project);
			}
		});
		tasks.collaborators.forEach(collaborator => {
			if(!self.tasks.collaborators.includes(collaboratorIte => {collaboratorIte.id == collaborator.id}))
			{
				self.tasks.collaborators.push(collaborator);
			}
		});
		// Remove/insert potential completed/uncompleted tasks
		items.forEach(item => {
			var idToCheck = item.id;
			if(item.parent_id != null)
			{
				idToCheck = item.parent_id;
			}
			var index = self.tasks.items.findIndex(itemToCheck => itemToCheck.parent.id == idToCheck);
			if(index != -1)
			{
				if(item.parent_id == null)
				{
					self.tasks.items[index].parent = item;
				}
				else
				{
					var subIndex = self.tasks.items[index].children.findIndex(itemToCheck => itemToCheck.id == item.id);
					if(subIndex != -1)
					{
						self.tasks.items[index].children[subIndex] = item;
					}
					else
					{
						self.tasks.items[index].children.push(item);
					}
				}
			}
			else
			{
				if(item.parent_id == null)
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
	parseCompletedTasks: function(completedTasks)
	{
		var self = this;
		var itemsNoParent = [];
		var labelIds = [];
		if (completedTasks == undefined) {
			return;
		}
		if (completedTasks.accessToken != self.config.accessToken) {
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
				if(self.config.projects.find(project => item.item_object.project_id == project) == undefined &&
					!self.isLabelInConfig(item.item_object.labels)) { return; }

				if (item.item_object.parent_id != null)
				{
					if(!self.config.displaySubtasks) { return; }
					else
					{
						var parentIndex = self.items.findIndex(itemToCheck => itemToCheck.parent == item.item_object.parent_id);
						if(parentIndex != -1)
						{
							self.sanitizeDate(item.item_object);
							self.tasks.items[parentIndex].children.push(sanitizedObject);
						}
						else
						{
							Log.error("Unhandled case; completed item is not a parent and has no matching parent id - item not conisdered");
						}
					}
				}
				else
				{
					// We always have completed at the end of the list
					self.sanitizeDate(item.item_object);
					self.tasks.items.push({parent: item.item_object, children: []});
				}
			});
		}
	},

	isLabelInConfig: function(labelsToCheck)
	{
		this.config.labels.forEach(function(label)
		{
			if(labelsToCheck.find(labelToCheck => label == labelToCheck) != undefined) { return true; }
		});
		return false;
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
	sortByTodoist: function (itemstoSort) {
		itemstoSort.sort(function (a, b) {
				return a.parent.id - b.parent.id;
		});
		itemstoSort.forEach(item => {
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
		return itemstoSort;
	},
	sortByDueDateAsc: function (itemstoSort) {
		itemstoSort.sort(function (a, b) {
			return a.date - b.date;
		});
		return itemstoSort;
	},
	sortByDueDateDesc: function (itemstoSort) {
		itemstoSort.sort(function (a, b) {
			return b.date - a.date;
		});
		return itemstoSort;
	},
	sortByPriority: function (itemstoSort) {
		itemstoSort.sort(function (a, b) {
			return b.priority - a.priority;
		});
		return itemstoSort;
	},
	sortByDueDateDescPriority: function (itemstoSort) {
		itemstoSort.sort(function (a, b) {
			if (a.date > b.date) return 1;
			if (a.date < b.date) return -1;

			if (a.priority < b.priority) return 1;
			if (a.priority > b.priority) return -1;
		});
		return itemstoSort;
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
	addTodoTextCell: function(item, preparedContent) {
		var temp = document.createElement('div');
		temp.innerHTML = item.contentHtml;

		var para = temp.getElementsByTagName('p');
		var taskText = para[0].innerHTML;

		var cellClasses = "title bright alignLeft";
		var antiWrapSubtraction = 0;
		// if sorting by todoist, indent subtasks under their parents
		if (this.config.sortType === "todoist" && item.parent_id) {
			// this item is a subtask so indent it
			taskText = '- ' + taskText;
			antiWrapSubtraction += 2;
		}
		
		if(item.checked)
		{
			cellClasses += " todoCompleted";
			antiWrapSubtraction += 1;
		}
		var maxTitleLength = this.config.maxTitleLength;
		if(true)
		{
			antiWrapSubtraction += preparedContent.innerHTML.length;
		}
		return this.createCell(cellClasses, 
			this.shorten(taskText, (this.config.maxTitleLength - antiWrapSubtraction), this.config.wrapEvents));

		// return this.createCell("title bright alignLeft", item.content);
	},
	addDueDateCell: function(item, preparedContent) {
		return this.createCell(preparedContent.className, preparedContent.innerHTML);
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
	addProjectCell: function(item) {
		var project = this.tasks.projects.find(p => p.id === item.project_id);
		var projectcolor = this.config.projectColors[project.color];
		var innerHTML = "<span class='projectcolor' style='color: " + projectcolor + "; background-color: " + projectcolor + "'></span>" + project.name;
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
	getDom: function () {
	
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

		//Iterate through Todos
		truncatedItems.forEach(item => {
			if(item.parent == null) { return; }
			var divRow = document.createElement("div");
			//Add the Row
			divRow.className = "divTableRow";
			
			/*Log.log(item.content);
			Log.log(item);*/
			//Columns
			divRow.appendChild(this.addPriorityIndicatorCell(item.parent));
			divRow.appendChild(this.addColumnSpacerCell());
			var preparedDueDateContent = this.prepareDueDateCell(item.parent);
			divRow.appendChild(this.addTodoTextCell(item.parent, preparedDueDateContent));
			divRow.appendChild(this.addDueDateCell(item.parent, preparedDueDateContent));
			if (this.config.showProject) {
				divRow.appendChild(this.addColumnSpacerCell());
				divRow.appendChild(this.addProjectCell(item.parent));
			}
			if (this.config.displayAvatar) {
				divRow.appendChild(this.addAssigneeAvatorCell(item.parent, collaboratorsMap));
			}

			divBody.appendChild(divRow);

			item.children.forEach(childItem =>{
				if(childItem == null){ return; }
				var childDivRow = document.createElement("div");
				//Add the Row
				childDivRow.className = "divTableRow";
				childDivRow.appendChild(this.addPriorityIndicatorCell(childItem));
				childDivRow.appendChild(this.addColumnSpacerCell());
				childDivRow.appendChild(this.addTodoTextCell(childItem, {innerHTML: "", className: ""}));
				if (this.config.displayAvatar) {
					childDivRow.appendChild(this.addAssigneeAvatorCell(childItem, collaboratorsMap));
				}

				divBody.appendChild(childDivRow);
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
		self = this;
		var maximumEntries = this.config.maximumEntries;
		if(maximumEntries == 0)
		{
			maximumEntries = 256;
		}
		var displayCompleted = this.config.displayCompleted;
		var deprioritizeCompleted = this.config.deprioritizeCompleted;
		var itemsToDisplay = [];
		var itemsCount = 0;
		this.tasks.items.forEach(item =>
		{
			if(itemsCount >= maximumEntries)
			{
				return itemsToDisplay;
			}
			// TODO why is a parent null???
			//if(item.parent === undefined) {return;}
			if(!item.parent.checked)
			{
				itemsToDisplay.push({parent: item.parent, children: []});
				itemsCount++;
				lastItemToDisplayIndex = itemsToDisplay.length-1;
				item.children.forEach(itemChild => {
					if(itemsCount >= maximumEntries)
					{
						return itemsToDisplay;
					}
					if(!itemChild.checked)
					{
						itemsToDisplay[lastItemToDisplayIndex].children.push(itemChild);
						itemsCount++;
					}
					else
					{
						if(deprioritizeCompleted)
						{
							itemsToDisplay[lastItemToDisplayIndex].children.push(null);
						}
						else
						{
							itemsToDisplay[lastItemToDisplayIndex].children.push(itemChild);
							itemsCount++;
						}
					}
				});
			}
			else if(displayCompleted)
			{
				if(deprioritizeCompleted)
				{
					itemsToDisplay.push({parent: null, children: []});	
				}
				else
				{
					itemsToDisplay.push({parent: item, children: []});	
					itemsCount++;
				}
			}
		});
		if(deprioritizeCompleted && displayCompleted)
		{
			for(let ii = 0; ii < itemsToDisplay.length; ii++)
			{
				if(itemsCount >= maximumEntries)
				{
					return itemsToDisplay;
				}
				if(itemsToDisplay[ii].parent == null)
				{
					itemsToDisplay[ii].parent = self.tasks.items[ii].parent;
					itemsCount++;
					for(let jj = 0; jj < itemsToDisplay[ii].children.length; jj++)
					{
						if(itemsCount >= maximumEntries)
						{
							return itemsToDisplay;
						}
						if(itemsToDisplay[ii].children[jj] == null)
						{
							itemsToDisplay[ii].children[jj] == self.tasks.items[ii].children[jj];
							itemsCount++;
						}
					}
				}
			}
		}
		return itemsToDisplay;
	}
});
