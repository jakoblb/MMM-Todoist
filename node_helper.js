"use strict";

const LogDiff = require("envsub/js/LogDiff");
/* Magic Mirror
 * Module: MMM-Todoist
 *
 * By Chris Brooker
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const request = require("request");
const showdown = require("showdown");

const markdown = new showdown.Converter();

module.exports = NodeHelper.create({
	start: function() {
		console.log("Starting node helper for: " + this.name);
	},

	socketNotificationReceived: function(notification, payload) {
		if (notification === "FETCH_TODOIST") {
			this.config = payload;
			this.fetchTodos();
		}
		else if(notification === "CHECK_COMPLETED")
		{
			this.config = payload;
			this.testCompleted();
		}
		else if(notification === "COMPLETE_ITEM")
		{
			this.config = payload.payload;
			this.completeItem(payload.id);
		}
	},

	fetchTodos : function() {
		var self = this;
		//request.debug = true;
		var acessCode = self.config.accessToken;
		var sync_token = self.config.syncToken;
		if(sync_token.length === 0)
		{
			sync_token = "*";
		}
		request({
			url: self.config.apiBase + "/" + self.config.apiVersion + "/" + self.config.todoistEndpoint + "/",
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cache-control": "no-cache",
				"Authorization": "Bearer " + acessCode
			},
			form: {
				sync_token: self.config.syncToken,
				resource_types: self.config.todoistResourceType
			}
		},
		function(error, response, body) {
			if (error) {
				self.sendSocketNotification("FETCH_ERROR", {
					error: error
				});
				return console.error(" ERROR - MMM-Todoist: " + error);
			}
			if(self.config.debug){
				console.log(body);
			}
			if (response.statusCode === 200) {
				var taskJson = JSON.parse(body);
				taskJson.items.forEach((item)=>{
					item.contentHtml = markdown.makeHtml(item.content);
				});
				taskJson.accessToken = acessCode;
				self.sendSocketNotification("TASKS", taskJson);
			}
			else{
				console.log("Todoist api request status="+response.statusCode);
			}
		});
	},

	testCompleted : function() {
		var self = this;
		//request.debug = true;
		var acessCode = self.config.accessToken;
		var dateToLookbackForCompleted = new Date(Date.now() - self.config.maksCompletedAgeDays * 24 * 60 * 60 * 1000);
		var dateString = dateToLookbackForCompleted.getFullYear()+"-"+String(dateToLookbackForCompleted.getMonth()+1).padStart(2, '0')+"-"+String(dateToLookbackForCompleted.getDate()).padStart(2, '0')+"T00:00:00.000000Z";
		request({
			url: self.config.apiBase + "/" + self.config.apiVersion + "/" + self.config.todoistEndpointCompleted + "/",
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cache-control": "no-cache",
				"Authorization": "Bearer " + acessCode
			},
			form: {
				since: dateString,
				annotate_items: true,
			}
		},
		function(error, response, body) {
			if (error) {
				self.sendSocketNotification("FETCH_ERROR", {
					error: error
				});
				return console.error(" ERROR - MMM-Todoist: " + error);
			}
			if(self.config.debug){
				console.log(body);
			}
			if (response.statusCode === 200) {
				var taskJson = JSON.parse(body);
				taskJson.items.forEach((item)=>{
					if(item.item_object!=undefined)
					{
						item.item_object.contentHtml = markdown.makeHtml(item.content);
					}
				});
				taskJson.accessToken = acessCode;
				self.sendSocketNotification("TASKS_INC_COMPLETED", taskJson);
			}
			else{
				console.log("Todoist api request status="+response.statusCode);
			}
		});
	},

	completeItem : function(id) {
		var self = this;
		//request.debug = true;
		var acessCode = self.config.accessToken;
		var dateToLookbackForCompleted = new Date(Date.now() - self.config.maksCompletedAgeDays * 24 * 60 * 60 * 1000);
		var dateString = dateToLookbackForCompleted.getFullYear()+"-"+String(dateToLookbackForCompleted.getMonth()+1).padStart(2, '0')+"-"+String(dateToLookbackForCompleted.getDate()).padStart(2, '0')+"T00:00:00.000000Z";
		request({
			url: self.config.apiBase + "/" + self.config.apiVersion + "/" + self.config.todoistEndpointCompleted + "/",
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cache-control": "no-cache",
				"Authorization": "Bearer " + acessCode
			},
			form: {
				commands:
				[
					{
						type: "item_complete",
						uuid: "",
						args:
						{
							id: id,
						}
					}
				]
			},
		},
		function(error, response, body) {
			if (error) {
				self.sendSocketNotification("FETCH_ERROR", {
					error: error
				});
				return console.error(" ERROR - MMM-Todoist: " + error);
			}
			if(self.config.debug){
				console.log(body);
			}
			if (response.statusCode === 200) {
				var taskJson = JSON.parse(body);
				taskJson.items.forEach((item)=>{
					if(item.item_object!=undefined)
					{
						item.item_object.contentHtml = markdown.makeHtml(item.content);
					}
				});
				taskJson.accessToken = acessCode;
				self.sendSocketNotification("TASKS_INC_COMPLETED", taskJson);
			}
			else{
				console.log("Todoist api request status="+response.statusCode);
			}
		});
	},
});