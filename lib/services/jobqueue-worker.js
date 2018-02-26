'use strict';

var events = require('events');
var util = require('util');
var lodash = Devebot.require('lodash');
var chores = Devebot.require('chores');
var JobqueueCommon = require('../keepouts/jobqueue-common.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  JobqueueCommon.call(self, params);

  var getSandboxName = function() {
    return params.sandboxName;
  };

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: getSandboxName()
  }).stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var runhookManager = params['devebot/runhookManager'];

  var jobQueueProcess = function (job, done) {
    var runhook = job.data;
    var runhook_info = lodash.omit(runhook, ['requestId', 'options', 'payload']);
    var runhook_name = chores.getFullname([runhook.package, runhook.name]);
    var context = {
      progressMeter: runhookManager.createProgressMeter(job)
    };

    if (runhookManager.isAvailable(runhook)) {
      runhook.requestId = runhook.requestId || LT.getLogID();
      var reqTr = LT.branch({ key: 'requestId', value: runhook.requestId });
      LX.has('trace') && LX.log('trace', reqTr.add({
        runhookName: runhook_name,
        runhook: runhook_info
      }).stringify({
        text: '{runhookName}#{requestId}: {runhook} - invoked'
      }));
      runhookManager.process(runhook, context).then(function(result) {
        LX.has('trace') && LX.log('trace', reqTr.add({
          runhookName: runhook_name,
          result: result
        }).stringify({
          text: '{runhookName}#{requestId} - finished: {result}'
        }));
        done && done(null, result);
      }).catch(function(error) {
        LX.has('error') && LX.log('error', reqTr.add({
          runhookName: runhook_name,
          error: error
        }).stringify({
          text: '{runhookName}#{requestId} - failed: {error}'
        }));
        done && done(error, null);
      });
    } else {
      LX.has('trace') && LX.log('trace', reqTr.add({
        runhookName: runhook_name,
        runhook: runhook_info
      }).stringify({
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
      jobQueue.process(event + '-' + getSandboxName(), jobQueueProcess);
    });
    jobQueue.process('jobqueue-global' + '-' + getSandboxName(), jobQueueProcess);
  }

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

util.inherits(Service, JobqueueCommon);

Service.referenceList = [ 'devebot/runhookManager' ];

module.exports = Service;
