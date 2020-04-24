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

var _updateSeriesPlayerExtraStatsPerMap = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ players_extra_stats_per_map: null }).catch(errorHandler("find matches with player_extra_stats_per_map is null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)

  var playersExtraStatsPerMap = []
  for (var i=0; i < match.match.maps.length;i++) {
    if (match.match.maps[i].statsId == null) continue
    var playersExtraStats= []
    var playerHashMap = await hltv.getPlayerExtraStats({startDate: f, endDate: t, rankingFilter: TOP_50, minMapCount: "1", maps:mapSlugToName(match.match.maps[i].name)})

    for(var j = 0;j< 10;j++) {
      if (j < 5) {
        playersExtraStats.push(playerHashMap[match.match.players.team1[j].id])
      } else {
        playersExtraStats.push(playerHashMap[match.match.players.team2[j-5].id])
      }
    }

    playersExtraStatsPerMap.push(playersExtraStats)
  }
  db.collection('matches').updateOne({_id: match._id}, {$set: {"players_extra_stats_per_map": playersExtraStatsPerMap}}).catch(errorHandler("updating players extra stats in match with id = " + match._id));
}

var _updateSeriesPlayerExtraStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ players_extra_stats: null }).catch(errorHandler("find matches with player_extra_stats is null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)
  var  playersExtraStats = []
  var playerHashMap = await hltv.getPlayerExtraStats({startDate: f, endDate: t, rankingFilter: TOP_50, minMapCount: "1"})

  console.log(match.match.id)
  for(var i = 0;i< 10;i++) {
    if (i < 5) {
      playersExtraStats.push(playerHashMap[match.match.players.team1[i].id])
    } else {
      playersExtraStats.push(playerHashMap[match.match.players.team2[i-5].id])
    }
  }
  console.log(playersExtraStats.length)
  return db.collection('matches').updateOne({_id: match._id}, {$set: {"players_extra_stats": playersExtraStats}}).catch(errorHandler("updating players extra stats in match with id = " + match._id));
}


var _updateSeriesPlayerStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ players_stats: null }).catch(errorHandler("find matches with player_stats is null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)
  var  playersStats = []
    
  for(var i = 0;i< 10;i++) {
    var ps = undefined
    if (i < 5) {
      ps = await hltv.getPlayerStats({id: match.match.players.team1[i].id, startDate: f, endDate: t, rankingFilter: TOP_50})
    } else {
      ps = await hltv.getPlayerStats({id: match.match.players.team2[i-5].id, startDate: f, endDate: t, rankingFilter: TOP_50})
    }
    playersStats.push(ps)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return db.collection('matches').updateOne({_id: match._id}, {$set: {"players_stats": playersStats}}).catch(errorHandler("updating players stats in match with id = " + match._id));
}

var _updateSeriesTeamExtraStatsPerMap = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ teams_extraStatsPerMap: null }).catch(errorHandler("find 1 match with team_extraStatsPerMap = null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)

  var team1ExtraStatsPerMap = []
  var team2ExtraStatsPerMap = []
  for (var i=0; i < match.match.maps.length;i++) {
    var teams = await hltv.getTeamExtraStats({startDate: f, endDate: t, rankingFilter: TOP_50, minMapCount: "1", maps: mapSlugToName(match.match.maps[i].name)})
    team1ExtraStatsPerMap.push(teams[match.match.team1.id])
    team2ExtraStatsPerMap.push(teams[match.match.team2.id])
  }
  db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_extraStatsPerMap.team1": team1ExtraStatsPerMap}}).catch(errorHandler("updating team1.ExtraStats in match with id = " + match._id));
  db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_extraStatsPerMap.team2": team2ExtraStatsPerMap}}).catch(errorHandler("updating team1.ExtraStats in match with id = " + match._id));
}

var _updateSeriesTeamExtraStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ teams_extraStats: null }).catch(errorHandler("find 1 match with team_extraStats = null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)

  var teams = await hltv.getTeamExtraStats({startDate: f, endDate: t, rankingFilter: TOP_50, minMapCount: "1"})
  db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_extraStats.team1": teams[match.match.team1.id]}}).catch(errorHandler("updating team1.ExtraStats in match with id = " + match._id));
  db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_extraStats.team2": teams[match.match.team2.id]}}).catch(errorHandler("updating team2.ExtraStats in match with id = " + match._id));
}

var _updateSeriesTeamStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ teams_stats: null }).catch(errorHandler("finding matches with team_stats = null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)

  var team_stat = await hltv.getTeamStats({id: match.match.team1.id, startDate: f, endDate: t, rankingFilter: TOP_50})
  await db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_stats.team1": team_stat}}).catch(errorHandler("updating team_stats.team1 in match with id = "+match._id))
  team_stat = await hltv.getTeamStats({id: match.match.team2.id, startDate: f, endDate: t, rankingFilter: TOP_50})
  await db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_stats.team2": team_stat}}).catch(errorHandler("updating team_stats.team2 in match with id = "+match._id))
}

var _updateSeriesStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ stats: null }).catch(errorHandler("find 1 match with stats = null"))
  if (match == null) return
  if (match.match.format.split(" ")[2] != "1"){
    var match_stat = await hltv.getMatchStats({id: match.match.statsId})
    return db.collection('matches').updateOne({_id: match._id}, {$set: {"stats": match_stat}}).catch(errorHandler("Update match stat with id = " + match._id));
  } else {
    return db.collection('matches').updateOne({_id: match._id}, {$set: {"stats": true}}).catch(errorHandler("Update match stat with id = " + match._id));
  }
}

var jobManager = function(u, n){
  var jobIndex = 0
  var workerName = n
  console.log("init busy")
  var busy = false
  const jobList = [
    {
      name: 'updateSeriesStats',
      handler: _updateSeriesStats,
      proxy: "",
    },
    {
      name: 'updateSeriesTeamStats',
      handler: _updateSeriesTeamStats,
      proxy: "",
    },
    {
      name: 'updateSeriesTeamExtraStats',
      handler: _updateSeriesTeamExtraStats,
      proxy: "",
    },
    {
      name: 'updateSeriesTeamExtraStatsPerMap',
      handler: _updateSeriesTeamExtraStatsPerMap,
      proxy: "",
    },
    {
      name: 'updateSeriesPlayerStats',
      handler: _updateSeriesPlayerStats,
      proxy: "",
    },
    {
      name: 'updateSeriesPlayerExtraStats',
      handler: _updateSeriesPlayerExtraStats,
      proxy: "",
    },
    {
      name: 'updateSeriesPlayerExtraStatsPerMap',
      handler: _updateSeriesPlayerExtraStatsPerMap,
      proxy: "",
    },
  ]

  return {
    setUpProxies: async function(i) {
      if (!u) return
      busy = true
      var newProxy = await changeProxy("")
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
      if (err[0] == 429) {
        console.log("requests to HLTV are blocked because rate limiting: %s", err[1])
        jobList[jobIndex].proxy = await changeProxy(jobList[jobIndex].proxy)
      }
      else
        console.error(err)
    },
  }
}(false, "SeriesUpdater")

function startCronScheduler(){
  var job = new CronJob(process.env.CRON_SERIES_UPDATE_FORMAT, jobManager.execute, null, false);
  job.start()
  jobManager.setUpProxies()
}

module.exports = {
    startCronScheduler
};
