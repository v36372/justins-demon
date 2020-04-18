require('dotenv').config();
const getHLTV = require('./hltvWrapper').getHLTV;
const createHLTV = require('./hltvWrapper').createHLTV;
const eHandler = require('./hltvWrapper').errorHandler;
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

  createHLTV()
});

var _updateUpcomingMatch = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('upcoming_and_live_matches').findOne({details: null}, function(err, target){
    if (!target) return 
    console.log("trying to update upcoming match %s", target._id)
    hltv.getMatch({id: target.id}).then(res => {
      db.collection('upcoming_and_live_matches').updateOne({_id: target._id}, {$set: {"details": res}}, errorHandler("update upcoming match with id = " + target._id))
    }).catch(eHandler)
  })
}

var _crawlUpcomingMatches = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  hltv.getMatches().then((matches) => {
    matches.forEach(function(match){
      db.collection('upcoming_and_live_match').findOne({"match.id": match.id}, function(err, target){
        if (target == null)
          db.collection('upcoming_and_live_match').insertOne({"match": match}, errorHandler("insert 1 upcoming match"))
        else
          db.collection('upcoming_and_live_match').updateOne({_id: target._id}, {$set: {"match": match}}, errorHandler("update 1 upcoming match"))

      })
    })
  }).catch(eHandler)
}

var _updateTeam = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('teams').findOne({ stats: null }, function(err, team){
    if (err) {
      console.error(err)
      return
    }
    if (team == null) return;
    hltv.getTeamStats({id: team.team.id}).then((team_stat) => {
      console.log("update team stats ", team._id)
      if (team_stat === null) {
        return
      }
      db.collection('teams').updateOne({_id: team._id}, {$set: {"stats": team_stat}}, errorHandler("updating team with id = " + team._id));
    }).catch(eHandler)
  });
}

var _updateSeries = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('match_maps').findOne({ update_series: null, stats: {$exists: true} }, function(err, result){
    if (err) {
      console.error(err)
      return
    }
    if (result == null) return;
    db.collection('matches').findOne({"match.id": result.stats.matchPageID}, function(err, match){
      if (match == null) {
        hltv.getMatch({id: result.stats.matchPageID}).then((match) => {
          db.collection('matches').insertOne({match: match}, errorHandler("Inserting 1 serie with id = " + match.id))
        }).catch(eHandler)
      }
      db.collection('match_maps').updateOne({_id: result._id}, {$set: {update_series: true}}, errorHandler("Updating 1 map with updated_serie, id = " + result._id))
    })
  });
}

var _updateMapStats = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('match_maps').findOne({ stats: null }, function(err, match_map){
    if (err) {
      console.error(err)
      return
    }
    if (match_map == null) return;
    hltv.getMatchMapStats({id: match_map.id}).then((map_stat) => {
      db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {"stats": map_stat}}, function(err, res) {
        if (err) {
          console.error("error when crawl map stats", match_map.id, err)
          return
        }
        console.log("Number of match updated: 1");
      });
    }).catch(eHandler)
  });
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

var _updateSeriesPlayerStats = function() {
}

var _updateSeriesTeamExtraStats = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('matches').findOne({ teams_extraStats: null }, function(err, match){
    if (match == null) return;
    var f = threeMonthsAgo(match.match.date)
    var t = yesterday(match.match.date)

    hltv.getTeamExtraStats({startDate: f, endDate: t, rankingFilter: TOP_50}).then((teams) => {
      db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_extraStats.team1": teams[match.match.team1.id]}}, errorHandler("updating team1.ExtraStats in match with id = " + match._id));
      db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_extraStats.team2": teams[match.match.team2.id]}}, errorHandler("updating team2.ExtraStats in match with id = " + match._id));
    }).catch(eHandler)
  });
}

var _updateSeriesTeamStats = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('matches').findOne({ teams_stats: null }, function(err, match){
    if (match == null) return;
    var f = threeMonthsAgo(match.match.date)
    var t = yesterday(match.match.date)

    hltv.getTeamStats({id: match.match.team1.id, startDate: f, endDate: t, rankingFilter: TOP_50}).then((team_stat) => {
      db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_stats.team1": team_stat}}, errorHandler("updating team1.stats in match with id = " + match._id));
    }).then(() => {
      hltv.getTeamStats({id: match.match.team2.id, startDate: f, endDate: t, rankingFilter: TOP_50}).then((team_stat) => {
        db.collection('matches').updateOne({_id: match._id}, {$set: {"teams_stats.team2": team_stat}}, errorHandler("updating team2.stats in match with id = " + match._id));
      }).catch(eHandler)
    }).catch(eHandler)
  });
}

var _updateSeriesStats = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('matches').findOne({ stats: null }, function(err, match){
    if (err) {
      console.error(err)
      return
    }
    if (match == null) return;
    console.log(match.match.statsId)
    if (match.match.format != "Best of 1"){
      hltv.getMatchStats({id: match.match.statsId}).then((match_stat) => {
        db.collection('matches').updateOne({_id: match._id}, {$set: {"stats": match_stat}}, errorHandler("Update match stat with id = " + match._id));
      }).catch(eHandler)
    } else {
      db.collection('matches').updateOne({_id: match._id}, {$set: {"stats": true}}, errorHandler("Update match stat with id = " + match._id));
    }
  });
}


var _crawlNewMaps = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  var t = new Date()
  var f = new Date(new Date().setDate(t.getDate()-1))

  hltv.getMatchesStats({startDate: dis(f), endDate: dis(t), rankingFilter: TOP_50}).then((matches) => {
    matches.forEach(function(item){
      db.collection('match_maps').findOne({id: item.id}, function(err, result){
        if (result !== null) {
          console.warn("trying to insert exited match", item.id)
          return
        }
        console.log("insert new map")
        db.collection('match_maps').insertOne(item, errorHandler("inserting new maps with id = " + item.id));
      });
    })
  }).catch(eHandler)
}

var runJob = function(){
  var jobIndex = 0
  const jobList = [
    /*
    {
      name: 'crawlUpcomingMatches',
      handler: _crawlUpcomingMatches,
    },
    {
      name: 'crawlNewMaps', 
      handler: _crawlNewMaps,
    },
    {
      name: 'updateMapStats',
      handler: _updateMapStats,
    },
    {
      name: 'updateSeries',
      handler: _updateSeries,
    },
    {
      name: 'updateSeriesStats',
      handler: _updateSeriesStats,
    },
    */
    {
      name: 'updateSeriesTeamExtraStats',
      handler: _updateSeriesTeamExtraStats,
    },
    {
      name: 'updateSeriesTeamStats',
      handler: _updateSeriesTeamStats,
    },
  ]

  return function(){
    console.log("starting cron job %s", jobList[jobIndex].name)
    jobList[jobIndex].handler()

    if (jobIndex == jobList.length-1)
      jobIndex = 0;
    else
      jobIndex++;
  }
}()

function startCronScheduler(){
  var job = new CronJob(process.env.CRON_FORMAT, runJob, null, false);
  job.start()
}

module.exports = {
    startCronScheduler
};
