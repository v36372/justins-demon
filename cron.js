require('dotenv').config();
const getHLTV = require('./hltvWrapper').getHLTV;
const changeProxy = require('./hltvWrapper').changeProxy;
const errorHandler = require('./mongodbUtil').errorHandler;
const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const assert = require("assert");
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
  console.log(matches)
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
  var match = await db.collection('matches').findOne({"match.id": result.stats.matchPageID}).catch(errorHandler("find match with id = " + result.stats.matchPageID))
  if (match == null) {
    var match = await hltv.getMatch({id: result.stats.matchPageID})
    await db.collection('matches').insertOne({match: match}).catch(errorHandler("Inserting 1 serie with id = " + match.id))
  }
  return db.collection('match_maps').updateOne({_id: result._id}, {$set: {update_series: true}}).catch(errorHandler("Updating 1 map with updated_serie, id = " + result._id))
}

var _updateMapStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match_map = await db.collection('match_maps').findOne({ stats: null }).catch(errorHandler(""))
  if (match_map == null) return
  var map_stat = await hltv.getMatchMapStats({id: match_map.id})
  return db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {"stats": map_stat}}).catch(errorHandler("updating 1 match_maps, set stats with map_id = " + match_map.id))
}

function dis(dateObj){
  return dateObj.toISOString().slice(0,10)
}

function threeMonthsAgo(unix) {
  var c = new Date(unix)
  var o = new Date(c.setMonth(c.getMonth()-3))
  return dis(o)
}

function yesterday(unix) {
  var c = new Date(unix)
  var o = new Date(c.setDate(c.getDate()-1))
  return dis(o)
}

var _updateSeriesPlayerStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ players_stats: null }).catch(errorHandler("find matches with player_stats is null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)
  var  playersStats = []
  var getPlayerStat = function* () {
    for(var i = 0;i< 10;i++) {
      if (i < 5) {
        yield hltv.getPlayerStats({id: match.match.players.team1[i].id, startDate: f, endDate: t, rankingFilter: TOP_50})
      } else {
        yield hltv.getPlayerStats({id: match.match.players.team2[i-5].id, startDate: f, endDate: t, rankingFilter: TOP_50})
      }
    }
  }
    
  for await (const playerStat of getPlayerStat()) {
    playersStats.push(playerStat)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return db.collection('matches').updateOne({_id: match._id}, {$set: {"players_stats": playersStats}}).catch(errorHandler("updating players stats in match with id = " + match._id));
}

var _updateSeriesTeamExtraStats = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var match = await db.collection('matches').findOne({ teams_extraStats: null }).catch(errorHandler("find 1 match with team_extraStats = null"))
  if (match == null) return
  var f = threeMonthsAgo(match.match.date)
  var t = yesterday(match.match.date)

  var teams = await hltv.getTeamExtraStats({startDate: f, endDate: t, rankingFilter: TOP_50})
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
  if (match.match.format.split(" ")[2] != ""){
    var match_stat = await hltv.getMatchStats({id: match.match.statsId})
    return db.collection('matches').updateOne({_id: match._id}, {$set: {"stats": match_stat}}).catch(errorHandler("Update match stat with id = " + match._id));
  } else {
    return db.collection('matches').updateOne({_id: match._id}, {$set: {"stats": true}}).catch(errorHandler("Update match stat with id = " + match._id));
  }
}

var _crawlNewMaps = async function(proxy) {
  const db = getDb().db();
  const hltv = getHLTV(proxy);

  var t = new Date()
  var f = new Date(new Date().setDate(t.getDate()-1))

  var matches = await hltv.getMatchesStats({startDate: dis(f), endDate: dis(t), rankingFilter: TOP_50})
  console.log(matches)
  for (const match in matches) {
    var match_maps = db.collection('match_maps').findOne({id: match.id}).catch(errorHandler("finding 1 maps with id = " + match.id))
    if (match_maps !== null) continue
    db.collection('match_maps').insertOne(match, errorHandler("inserting new maps with id = " + match.id));
  }
}

var jobManager = function(){
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
    {
      name: 'updateSeriesStats',
      handler: _updateSeriesStats,
      proxy: "",
    },
    {
      name: 'updateSeriesTeamExtraStats',
      handler: _updateSeriesTeamExtraStats,
      proxy: "",
    },
    {
      name: 'updateSeriesTeamStats',
      handler: _updateSeriesTeamStats,
      proxy: "",
    },
    {
      name: 'updateSeriesPlayerStats',
      handler: _updateSeriesPlayerStats,
      proxy: "",
    },
  ]

  return {
    execute: async function(){
      if (busy) return
      console.log("starting cron job %s with proxy %s", jobList[jobIndex].name, jobList[jobIndex].proxy)
      busy = true
      await jobList[jobIndex].handler(jobList[jobIndex].proxy).catch(errorHandler(jobIndex))
      busy = false;

      if (jobIndex == jobList.length-1)
        jobIndex = 0;
      else
        jobIndex++;
    },
    reset: () => busy = false,
    errorHandler: (jobIndex) => (err) => {
      if (err[0] == 429) {
        console.log("requests to HLTV are blocked because rate limiting: %s", err[1])
        jobList[jobIndex].proxy = changeProxy(jobList[jobIndex].proxy)
      }
      else
        console.error(err)
    },
  }
}()

function startCronScheduler(){
  var job = new CronJob(process.env.CRON_FORMAT, jobManager.execute, null, false);
  job.start()
}

module.exports = {
    startCronScheduler
};
