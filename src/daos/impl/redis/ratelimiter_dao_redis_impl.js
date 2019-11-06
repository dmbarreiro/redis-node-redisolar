const redis = require('./redis_client');
const keyGenerator = require('./redis_key_generator');

/**
  * Record a hit against a unique resource that is being
  * rate limited.  Will return 0 when the resource has hit
  * the rate limit.
  * @param {string} name - the unique name of the resource.
  * @param {Object} opts - object containing interval and maxHits details:
  *   {
  *     interval: 1,
  *     maxHits: 5
  *   }
  * @returns {Promise} - Promise that resolves to number of hits remaining,
  *   or 0 if the rate limit has been exceeded..
  *
  * @private
  */
const hitFixedWindow = async (name, opts) => {
  const client = redis.getClient();
  const key = keyGenerator.getRateLimiterKey(name, opts.interval, opts.maxHits);
  const pipeline = client.batch();

  pipeline.incr(key);
  pipeline.expire(key, opts.interval * 60);

  const response = await pipeline.execAsync();
  const hits = parseInt(response[0], 10);

  let hitsRemaining;

  if (hits > opts.maxHits) {
    // Too many hits.
    hitsRemaining = 0;
  } else {
    // Return number of hits remaining.
    hitsRemaining = opts.maxHits - hits;
  }

  return hitsRemaining;
};

/* eslint-disable no-unused-vars */
// Challenge 7
const hitSlidingWindow = async (name, opts) => {
  const client = redis.getClient();
  const key = keyGenerator.getRateLimiterKey(name, opts.interval, opts.maxHits, true);
  const slidingRateLimiterTransaction = client.multi();

  const currentTimestamp = Date.now();
  const windowSizeMilisec = opts.interval * 1000;
  const minimumValidTimestamp = currentTimestamp - windowSizeMilisec;

  slidingRateLimiterTransaction.zadd(key, currentTimestamp, Math.random());
  slidingRateLimiterTransaction.zremrangebyscore(key, '-inf', `(${minimumValidTimestamp}`);
  slidingRateLimiterTransaction.zcard(key);

  const response = await slidingRateLimiterTransaction.execAsync();
  const hits = parseInt(response[2], 10);

  let hitsRemaining;

  if (hits > opts.maxHits) {
    // Too many hits.
    hitsRemaining = 0;
  } else {
    // Return number of hits remaining.
    hitsRemaining = opts.maxHits - hits;
  }

  return hitsRemaining;
};
/* eslint-enable */

module.exports = {
  /**
   * Record a hit against a unique resource that is being
   * rate limited.  Will return 0 when the resource has hit
   * the rate limit.
   * @param {string} name - the unique name of the resource.
   * @param {Object} opts - object containing interval and maxHits details:
   *   {
   *     interval: 1,
   *     maxHits: 5
   *   }
   * @returns {Promise} - Promise that resolves to number of hits remaining,
   *   or 0 if the rate limit has been exceeded..
   */
  hit: hitFixedWindow, // Challenge 7: change to hitSlidingWindow
};
