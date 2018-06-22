'use strict';

const events = require('events');
const util = require('util');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');
const chores = Devebot.require('chores');
const JobqueueCommon = require('../keepouts/jobqueue-common');

function JobqueueMaster(params) {
  params = params || {};
  JobqueueCommon.call(this, params);

  let self = this;
  let sandboxName = params.sandboxName;
  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({ sandboxName }).toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  self.enqueueJob = function(runhook) {
    if (self.enabled === false) {
      return Promise.reject(util.format('jobqueue on sandbox[%s] is disabled', sandboxName));
    }

    runhook = runhook || {};
    runhook.requestId = runhook.requestId || LT.getLogID();
    runhook.optimestamp = Date.now();

    let reqTr = LT.branch({ key: 'requestId', value: runhook.requestId });
    let runhookInfo = lodash.omit(runhook, ['requestId', 'options', 'payload']);
    let runhookName = chores.getFullname([runhook.package, runhook.name]);

    return new Promise(function(onResolved, onRejected) {
      let jobQueueName = self.getJobQueueOfRoutine(runhook.name);

      let stdTask = new events.EventEmitter();

      let kueTask = self.getJobQueue().create(jobQueueName, runhook);
      kueTask
        .on('enqueue', function(queueName) {
          LX.has('trace') && LX.log('trace', reqTr.add({ runhookName, runhookInfo }).toMessage({
            text: '{runhookName}#{requestId} - started: {runhookInfo}'
          }));
          stdTask.emit('started', queueName);
        })
        .on('promotion', function(data) {
          LX.has('trace') && LX.log('trace', reqTr.add({ runhookName }).toMessage({
            text: '{runhookName}#{requestId} - promotion'
          }));
        })
        .on('progress', function(progress, data) {
          LX.has('conlog') && LX.log('conlog', reqTr.add({ runhookName, progress }).toMessage({
            text: '{runhookName}#{requestId} - progress: {progress}'
          }));
          stdTask.emit('progress', { progress: progress, data: data });
        })
        .on('failed attempt', function(error, doneAttempts) {
          LX.has('error') && LX.log('error', reqTr.add({ runhookName, error }).toMessage({
            text: '{runhookName}#{requestId} - failed attempt: {error}'
          }));
        })
        .on('failed', function(error) {
          LX.has('error') && LX.log('error', reqTr.add({ runhookName, error }).toMessage({
            text: '{runhookName}#{requestId} - failed: {error}'
          }));
          stdTask.emit('failed', error);
        })
        .on('complete', function(result) {
          LX.has('trace') && LX.log('trace', reqTr.add({ runhookName }).toMessage({
            text: '{runhookName}#{requestId} - completed'
          }));
          LX.has('conlog') && LX.log('conlog',
            '%s#%s - runhook: %s - completed - result: %s',
            runhookName, runhook.requestId, JSON.toMessage(runhook), JSON.toMessage(result));
          stdTask.emit('completed', result);
        })
        .on('remove', function(unknown) {
          LX.has('trace') && LX.log('trace', reqTr.add({ runhookName, runhookInfo }).toMessage({
            text: '{runhookName}#{requestId}: {runhookInfo} - removed'
          }));
          LX.has('conlog') && LX.log('conlog',
            'jobqueueMaster on sandbox[%s] - runhook: %s - removed - arguments: %s',
            sandboxName, JSON.toMessage(runhook), JSON.toMessage(arguments));
        });

      kueTask.removeOnComplete(true).save();

      onResolved(stdTask);
    });
  };

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

util.inherits(JobqueueMaster, JobqueueCommon);

module.exports = JobqueueMaster;
