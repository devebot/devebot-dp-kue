'use strict';

var events = require('events');
var util = require('util');

var JobQueue = require('kue');

var debug = require('debug');
var debuglog = debug('jobdapter');

var Service = function(params) {
  debuglog(' + constructor start ...');
  Service.super_.call(this);
  
  params = params || {};
  
  var redis_conf = params.redis || {};

  var jobQueue = JobQueue.createQueue({
    prefix: redis_conf.name || 'devebotjq',
    redis: {
      host: redis_conf.host,
      port: redis_conf.port || 6379,
      options: {
        retry_strategy: function (opts) {
          if (opts.error.code === 'ECONNREFUSED') {
            return new Error('The server refused the connection');
          }

          if (opts.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }

          if (opts.times_connected > 10) {
            return undefined; // End reconnecting with built in error
          }

          return Math.max(opts.attempt * 100, 3000); // reconnect after
        }
      }
    }
  });
  
  jobQueue.watchStuckJobs(1000);

  this.getJobQueue = function() {
    return jobQueue;
  };

  this.getServiceInfo = function() {
    return {};
  };

  this.getServiceHelp = function() {
    return {};
  };

  debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "jobdapter",
  "type": "object",
  "properties": {
    "redis": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
