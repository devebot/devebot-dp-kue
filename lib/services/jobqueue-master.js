'use strict';

var events = require('events');
var util = require('util');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var chores = Devebot.require('chores');
var JobqueueCommon = require('../keepouts/jobqueue-common.js');

function JobqueueMaster(params) {
  params = params || {};
  JobqueueCommon.call(this, params);

  var getSandboxName = function() {
    return params.sandboxName;
  };

  var self = this;
  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: getSandboxName()
  }).stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  self.enqueueJob = function(runhook) {
    if (self.enabled === false) {
      return Promise.reject(util.format('jobqueue on sandbox[%s] is disabled', getSandboxName()));
    }

    runhook = runhook || {};
    runhook.requestId = runhook.requestId || LT.getLogID();
    runhook.optimestamp = Date.now();

    var reqTr = LT.branch({ key: 'requestId', value: runhook.requestId });
    var runhook_info = lodash.omit(runhook, ['requestId', 'options', 'payload']);
    var runhook_name = chores.getFullname([runhook.package, runhook.name]);

    return new Promise(function(onResolved, onRejected) {
      var jobQueueName = self.getJobQueueOfRoutine(runhook.name);

      var stdTask = new events.EventEmitter();

      var kueTask = self.getJobQueue().create(jobQueueName, runhook);
      kueTask
        .on('enqueue', function(queueName) {
          LX.has('trace') && LX.log('trace', reqTr.add({
            runhookName: runhook_name,
            runhook: runhook_info
          }).stringify({
            text: '{runhookName}#{requestId} - started: {runhook}'
          }));
          stdTask.emit('started', queueName);
        })
        .on('promotion', function(data) {
          LX.has('trace') && LX.log('trace', reqTr.add({
            runhookName: runhook_name
          }).stringify({
            text: '{runhookName}#{requestId} - promotion'
          }));
        })
        .on('progress', function(progress, data) {
          LX.has('conlog') && LX.log('conlog', reqTr.add({
            runhookName: runhook_name,
            progress: progress
          }).stringify({
            text: '{runhookName}#{requestId} - progress: {progress}'
          }));
          stdTask.emit('progress', { progress: progress, data: data });
        })
        .on('failed attempt', function(errorMessage, doneAttempts) {
          LX.has('error') && LX.log('error', reqTr.add({
            runhookName: runhook_name,
            error: errorMessage
          }).stringify({
            text: '{runhookName}#{requestId} - failed attempt: {error}'
          }));
        })
        .on('failed', function(errorMessage) {
          LX.has('error') && LX.log('error', reqTr.add({
            runhookName: runhook_name,
            error: errorMessage
          }).stringify({
            text: '{runhookName}#{requestId} - failed: {error}'
          }));
          stdTask.emit('failed', errorMessage);
        })
        .on('complete', function(result) {
          LX.has('trace') && LX.log('trace', reqTr.add({
            runhookName: runhook_name
          }).stringify({
            text: '{runhookName}#{requestId} - completed'
          }));
          LX.has('conlog') && LX.log('conlog',
            '%s#%s - runhook: %s - completed - result: %s',
            runhook_name, runhook.requestId,
            JSON.stringify(runhook), JSON.stringify(result));
          stdTask.emit('completed', result);
        })
        .on('remove', function(unknown) {
          LX.has('trace') && LX.log('trace', reqTr.add({
            runhookName: runhook_name,
            runhook: runhook_info
          }).stringify({
            text: '{runhookName}#{requestId}: {runhook} - removed'
          }));
          LX.has('conlog') && LX.log('conlog',
            'jobqueueMaster on sandbox[%s] - runhook: %s - removed - arguments: %s',
            getSandboxName(), JSON.stringify(runhook), JSON.stringify(arguments));
        });

      kueTask.removeOnComplete(true).save();

      onResolved(stdTask);
    });
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

util.inherits(JobqueueMaster, JobqueueCommon);

module.exports = JobqueueMaster;
