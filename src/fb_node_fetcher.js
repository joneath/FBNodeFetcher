var request = require('request'),
    PriorityQueue = require('priority-queue'),
    _ = require("../vender/underscore-min");

(function() {
  var FBNodeFetcher = function(opts) {
    var self = { },
        jobQueue = new PriorityQueue(),
        activeJobs = 0,
        activeJobLimit,
        jobsStopped = false,
        jobsRunning = false,
        baseUri = "https://graph.facebook.com/";

    opts = opts || { };

    (function(opts) {
      self.callbackUrl = opts.callbackUrl;
      self.priority = opts.priority || 25;
      activeJobLimit = opts.activeJobLimit || 100;
    }).call(this, opts);

    var first = true;
    var start;

    self.fetch = function(data, callbackUrl) {
      if (first) {
        first = false;
        start = Date.now();
      }
      var nodes = self.processJSON(data);

      if (callbackUrl) {
        self.callbackUrl = callbackUrl;
      }

      _(nodes).each(function(node) {
        self.buildJob(node);
      });
      self.startJobs();
    };

    self.startJobs = function() {
      jobsStopped = false;
      if (!jobsRunning) {
        jobsRunning = true;
        while(activeJobs < activeJobLimit && !jobsStopped) {
          var job = jobQueue.pop();
          if (job) {
            self.runJob(job);
          } else {
            self.stopJobs();
          }
        }
        if (!jobsStopped) {
          setTimeout(function() {
            jobsRunning = false;
            self.startJobs();
          }, 50);
        }
      }
    };

    self.stopJobs = function() {
      jobsStopped = true;
      jobsRunning = false;
      console.log("Total time: " + (Date.now() - start) / 1000);
    };

    self.buildJob = function(node, priority) {
      var uri = self.buildGraphUri(node),
          callbackUrl = node.callbackUrl || self.callbackUrl;

      priority = priority || self.priority;

      var job = {
        uri: uri,
        callbackUrl: callbackUrl
      };
      jobQueue.push(job, priority);
    };

    self.runJob = function(job) {
      var currentJob = job;
      activeJobs += 1;
      request(job.uri, function (error, response, body) {
        activeJobs -= 1;
        var data = self.processJSON(body);
        if (!data.error){
          console.log("Total time: " + (Date.now() - start) / 1000);
          request.post({url: job.callbackUrl, data: body}, function (e, r, body) { });
        } else {
          console.log("error, re-queuing");
          jobQueue.push(currentJob, self.priority);
        }
      });
    };

    self.processJSON = function(data) {
      try {
        data = JSON.parse(data);
      } catch (e) { }
      return data;
    };

    self.buildGraphUri = function(node) {
      var uri = baseUri + node.graph_id;
      if (node.connection) {
        uri += "/" + node.connection;
      }
      if (node.access_token) {
        uri += "?access_token=" + node.access_token;
      }
      return uri;
    };

    return self;
  };

  module.exports = FBNodeFetcher;
}).call(this);
