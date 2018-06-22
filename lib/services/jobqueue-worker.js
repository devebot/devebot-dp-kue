'use strict';

var events = require('events');
var util = require('util');
var lodash = Devebot.require('lodash');
var chores = Devebot.require('chores');
var JobqueueCommon = require('../keepouts/jobqueue-common.js');

var JobqueueWorker = function(params) {
  params = params || {};
  JobqueueCommon.call(this, params);

  var self = this;
  var sandboxName = params.sandboxName;
  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: sandboxName
  }).toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var sandboxRegistry = params['devebot/sandboxRegistry'];

  var jobQueueProcess = function (job, done) {
    var runhook = job.data;
    var runhookInfo = lodash.omit(runhook, ['requestId', 'options', 'payload']);
    var runhookName = chores.getFullname([runhook.package, runhook.name]);
    var runhookManager = sandboxRegistry.lookupService('runhookManager', chores.injektorContext);
    var context = {
      progressMeter: runhookManager.createProgressMeter(job)
    };

    if (runhookManager.isAvailable(runhook)) {
      runhook.requestId = runhook.requestId || LT.getLogID();
      var reqTr = LT.branch({ key: 'requestId', value: runhook.requestId });
      LX.has('trace') && LX.log('trace', reqTr.add({
        runhookName: runhookName,
        runhook: runhookInfo
      }).toMessage({
        text: '{runhookName}#{requestId}: {runhook} - invoked'
      }));
      runhookManager.process(runhook, context).then(function(result) {
        LX.has('trace') && LX.log('trace', reqTr.add({
          runhookName: runhookName,
          result: result
        }).toMessage({
          text: '{runhookName}#{requestId} - finished: {result}'
        }));
        done && done(null, result);
      }).catch(function(error) {
        LX.has('error') && LX.log('error', reqTr.add({
          runhookName: runhookName,
          error: error
        }).toMessage({
          text: '{runhookName}#{requestId} - failed: {error}'
        }));
        done && done(error, null);
      });
    } else {
      LX.has('trace') && LX.log('trace', reqTr.add({
        runhookName: runhookName,
        runhook: runhookInfo
      }).toMessage({
        text: '{runhookName}#{requestId}: {runhook} - not found'
      }));
      done && done(null, {});
    }
  };

  if (self.enabled) {
    var jobQueueOfRoutine = self.getJobQueueMappings();
    var jobQueueEvents = lodash.pull(lodash.uniq(lodash.values(jobQueueOfRoutine)), 'jobqueue-global');

    var jobQueue = self.getJobQueue();
    lodash.forEach(jobQueueEvents, function(event) {
      jobQueue.process(event + '-' + sandboxName, jobQueueProcess);
    });
    jobQueue.process('jobqueue-global' + '-' + sandboxName, jobQueueProcess);
  }

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

util.inherits(JobqueueWorker, JobqueueCommon);

JobqueueWorker.referenceList = [ 'devebot/sandboxRegistry' ];

module.exports = JobqueueWorker;
