var request = require('request'),
    PriorityQueue = require('priority-queue'),
    _ = require("../vender/underscore-min");

(function() {
  var FBNodeFetcher = function(opts) {
    var self = { },
        fetchJobQueue = new PriorityQueue(),
        processJobQueue = new PriorityQueue(),
        activeFetchJobs = 0,
        activeFetchJobLimit,
        activeProcessJobs = 0,
        activeProcessJobLimit,
        fetchJobsStopped = false,
        fetchJobsRunning = false,
        processJobsStopped = false,
        processJobsRunning = false,
        graphUri = "https://graph.facebook.com/";

    opts = opts || { };

    (function(opts) {
      self.callbackUrl = opts.callbackUrl;
      self.fetchPriority = opts.priority || 25;
      self.processPriority = opts.priority || 25;
      activeFetchJobLimit = opts.activeFetchJobLimit || 100;
      activeProcessJobLimit = opts.activeProcessJobLimit || 100;
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
        self.buildFetchJob(node);
      });

      self.startFetchJobs();
      self.startProcessJobs();
    };

    self.ratchet = function(data) {
      var delta;

      data = self.processJSON(data);
      delta = data.delta || Math.round(activeFetchJobLimit / 10);
      delta = data.direction === "up" ? delta : -delta;

      if (data.queue === "fetch") {
        activeFetchJobLimit += delta;
        activeFetchJobLimit = Math.abs(activeFetchJobLimit);

      } else if (data.queue === "process") {
        activeProcessJobLimit += delta;
        activeProcessJobLimit = Math.abs(activeProcessJobLimit);
      }
    };

    self.startFetchJobs = function() {
      fetchJobsStopped = false;
      if (!fetchJobsRunning) {
        fetchJobsRunning = true;
        while(activeFetchJobs < activeFetchJobLimit && !fetchJobsStopped) {
          var job = fetchJobQueue.pop();
          if (job) {
            self.runFetchJob(job);
          } else {
            self.stopFetchJobs();
          }
        }
        if (!fetchJobsStopped) {
          setTimeout(function() {
            fetchJobsRunning = false;
            self.startFetchJobs();
          }, 50);
        }
      }
    };

    self.startProcessJobs = function() {
      processJobsStopped = false;
      if (!processJobsRunning) {
        processJobsRunning = true;
        while(activeProcessJobs < activeProcessJobLimit && !processJobsStopped) {
          var job = processJobQueue.pop();
          if (job) {
            self.runProcessJob(job);
          } else {
            self.stopProcessJobs();
          }
        }
        setTimeout(function() {
          processJobsRunning = false;
          self.startProcessJobs();
        }, 50);
      }
    };

    self.stopFetchJobs = function() {
      fetchJobsStopped = true;
      fetchJobsRunning = false;
    };

    self.stopProcessJobs = function() {
      processJobsStopped = true;
      processJobsRunning = false;
    };

    self.buildFetchJob = function(node, priority) {
      var uri = self.buildGraphUri(node),
          callbackUrl = node.callbackUrl || self.callbackUrl,
          connection = node.connection || "",
          pagesBack = node.pages_back || 1;
          until = node.until;

      priority = node.priority || self.fetchPriority;

      var job = {
        priority: priority,
        graph_id: node.graph_id,
        access_token: node.access_token,
        connection: connection,
        uri: uri,
        callbackUrl: callbackUrl,
        pagesBack: pagesBack,
        currentPage: 1,
        until: until
      };

      fetchJobQueue.push(job, priority);
    };

    self.buildProcessJob = function(fetchJob) {
      var job = {
        priority: fetchJob.priority,
        callbackUrl: fetchJob.callbackUrl,
        data: fetchJob.data
      };

      processJobQueue.push(job, job.priority);
    };

    self.processData = function(job, data) {
      var found = false;
      if (job.data && job.data.data) {
        _(data.data).each(function(node) {
          job.data.data.push(node);
        });
      } else {
        job.data = data;
      }

      if (job.until) {
        _(data.data).each(function(node, i) {
          if (node.id === job.until) {
            data.data = data.data.slice(0, i);
            found = true;
          }
        });
      }

      if (job.currentPage < job.pagesBack || (job.until && !found)) {
        job.currentPage += 1;
        job.uri = data.paging.next;
        self.runFetchJob(job);
      } else {
        self.buildProcessJob(job);
      }
    };

    self.runFetchJob = function(job) {
      var currentJob = job;
      activeFetchJobs += 1;
      request(job.uri, function (error, response, body) {
        activeFetchJobs -= 1;
        var data = self.processJSON(body);
        if (response.statusCode >= 200 && response.statusCode < 400 && (!error || !data.error)){
          self.processData(job, data);
        } else {
          console.log("error fetching, re-queuing");
          fetchJobQueue.push(currentJob, self.fetchPriority);
        }
      });
    };

    self.runProcessJob = function(job) {
      var currentJob = job;
      activeProcessJobs += 1;
      request.post({url: job.callbackUrl, json: job.data}, function (error, response, body) {
        activeProcessJobs -= 1;

        var data = self.processJSON(body);
        if (error || data.error){
          console.log("error processing, re-queuing");

          self.processPriority += 1;
          processJobQueue.push(currentJob, self.processPriority);
        }
        else if (response.statusCode >= 400) {
          console.log("Posting to " + currentJob.callbackUrl + " resulted in the following status code: " + response.statusCode);

          if (response.statusCode == 422) {
            console.log("Job will now be dropped");
            console.log(JSON.stringify(currentJob));
          }
          else {
            console.log("Job will be re-queued");

            self.processPriority += 1;
            processJobQueue.push(currentJob, self.processPriority);
          }
        }
        else {
          if (self.processPriority > 1){
            self.processPriority -= 1;
          }
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
      var uri = graphUri + node.graph_id;
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
