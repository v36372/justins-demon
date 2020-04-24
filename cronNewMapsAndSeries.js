require('dotenv').config();
const getHLTV = require('./hltvWrapper').getHLTV;
const changeProxy = require('./hltvWrapper').proxyManager.changeProxy;
const errorHandler = require('./mongodbUtil').errorHandler;
const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const assert = require("assert");
const mapSlugToName = require("./utils").mapSlugToName
const dis = require("./utils").dis
const threeMonthsAgo = require("./utils").threeMonthsAgo
const yesterday = require("./utils").yesterday
var CronJob = require('cron').CronJob;

const TOP_50 = "Top50"

initDb(function (err) {
  if (err != null) {
    console.error(err)
  }
});

var _updateUpcomingMatch = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var target = await db.collection('upcoming_and_live_matches').findOne({details: null}).catch(errorHandler("find one upcoming match with stats = null"))
  var res = await hltv.getMatch({id: target.id})
  return db.collection('upcoming_and_live_matches').updateOne({_id: target._id}, {$set: {"details": res}}).catch(errorHandler("update upcoming match with id = " + target._id))
}

var _crawlUpcomingMatches = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var matches = await hltv.getMatches()
  for (const match of matches) {
      var target = db.collection('upcoming_and_live_match').findOne({"match.id": match.id}).catch(errorHandler("finding 1 upcoming matcch with id = " + match.id))
      if (target == null)
        db.collection('upcoming_and_live_match').insertOne({"match": match}).catch(errorHandler("insert 1 upcoming match"))
      else
        db.collection('upcoming_and_live_match').updateOne({_id: target._id}, {$set: {"match": match}}).catch(errorHandler("update 1 upcoming match"))
  }
}

var _updateTeam = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var team = await db.collection('teams').findOne({ stats: null }).catch(errorHandler("finding team with stats = null"))
  if (team == null) return
  var team_stat = await hltv.getTeamStats({id: team.team.id})
  return db.collection('teams').updateOne({_id: team._id}, {$set: {"stats": team_stat}}).catch(errorHandler("updating team with id = " + team._id));
}

var _updateSeries = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match_map = await db.collection('match_maps').findOne({ update_series: null, stats: {$exists: true} }).catch(errorHandler("finding 1 maps don't have series"))
  if (match_map == null) return
  var match = await db.collection('matches').findOne({"match.id": match_map.stats.matchPageID}).catch(errorHandler("find match with id = " + match_map.stats.matchPageID))
  if (match == null) {
    var match = await hltv.getMatch({id: match_map.stats.matchPageID})
    await db.collection('matches').insertOne({match: match}).catch(errorHandler("Inserting 1 serie with id = " + match.id))
  }
  return db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {update_series: true}}).catch(errorHandler("Updating 1 map with updated_serie, id = " + match_map._id))
}

var _updateMapStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match_map = await db.collection('match_maps').findOne({ stats: null }).catch(errorHandler(""))
  if (match_map == null) return
  var map_stat = await hltv.getMatchMapStats({id: match_map.id})
  return db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {"stats": map_stat}}).catch(errorHandler("updating 1 match_maps, set stats with map_id = " + match_map.id))
}

var _crawlNewMaps = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var today = new Date()
  var t = new Date(new Date().setDate(today.getDate()-1))
  var f = new Date(new Date().setDate(today.getDate()-2))

  var matches = await hltv.getMatchesStats({startDate: dis(f), endDate: dis(t), rankingFilter: TOP_50})
  for (const match in matches) {
    var match_maps = db.collection('match_maps').findOne({id: match.id}).catch(errorHandler("finding 1 maps with id = " + match.id))
    if (match_maps !== null) continue
    db.collection('match_maps').insertOne(match, errorHandler("inserting new maps with id = " + match.id));
  }
}

var jobManager = function(u, n){
  var jobIndex = 0
  console.log("init busy")
  var busy = false
  const jobList = [
    /*
    {
      name: 'crawlUpcomingMatches',
      handler: _crawlUpcomingMatches,
      proxy: "",
    },
    */
    {
      name: 'crawlNewMaps', 
      handler: _crawlNewMaps,
      proxy: "",
    },
    {
      name: 'updateMapStats',
      handler: _updateMapStats,
      proxy: "",
    },
    {
      name: 'updateSeries',
      handler: _updateSeries,
      proxy: "",
    },
  ]

  return {
    setUpProxies: async function(i) {
      if (!u) return
      busy = true
      var newProxy = await changeProxy("", true)
      for (job of jobList) {
        job.proxy = newProxy
      }
      busy = false
    },
    execute: async function(){
      if (busy) return
      console.log("Worker %s starting cron job %s with proxy %s", n, jobList[jobIndex].name, jobList[jobIndex].proxy)
      busy = true
      await jobList[jobIndex].handler(jobList[jobIndex].proxy).catch(errorHandler(jobIndex))
      busy = false;

      if (jobIndex == jobList.length-1)
        jobIndex = 0;
      else
        jobIndex++;
    },
    errorHandler: (jobIndex) => async (err) => {
      console.error(err)
      var shouldChange = false
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET')
        shouldChange = true
      if (err[0] >= 400 && err[0] < 500)
        shouldChange = true
      if (err[0] == 429)
        console.log("requests to HLTV are blocked because rate limiting: %s", err[1])
      if (shouldChange)
        jobList[jobIndex].proxy = await changeProxy(jobList[jobIndex].proxy)
    },
  }
}(process.env.USE_PROXY, "NewMapsAndSeries")

function startCronScheduler(){
  var job = new CronJob(process.env.CRON_NEW_MAPS_FORMAT, jobManager.execute, null, false);
  job.start()
  jobManager.setUpProxies()
}

module.exports = {
    startCronScheduler
};
