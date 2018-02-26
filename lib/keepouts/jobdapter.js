'use strict';

var events = require('events');
var util = require('util');
var JobQueue = require('kue');
var pinbug = Devebot.require('pinbug')('devebot-dp-kue/jobdapter');

var Service = function(params) {
  pinbug.enabled && pinbug(' + constructor start ...');
  events.EventEmitter.call(this);

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

  pinbug.enabled && pinbug(' - constructor has finished');
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
