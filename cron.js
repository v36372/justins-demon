require('dotenv').config();
const getHLTV = require('./hltvWrapper').getHLTV;
const createHLTV = require('./hltvWrapper').createHLTV;
const eHandler = require('./hltvWrapper').errorHandler;
const errorHandler = require('./mongodbUtil').errorHandler;
const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const assert = require("assert");
var CronJob = require('cron').CronJob;

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
    db.collection('matches').findOne({id: result.stats.matchPageID}, function(err, match){
      if (match == null) {
        hltv.getMatch({id: result.stats.matchPageID}).then((match) => {
          db.collection('matches').insertOne({match: match}, errorHandler("Inserting 1 serie with id = " + match.id))
        }).catch(eHandler)
      }
      db.collection('match_maps').updateOne({_id: result._id}, {$set: {update_series: true}}, errorHandler("Updating 1 map with updated_serie, id = " + result._id))
    })
  });
}

var _updateMatch = function() {
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

var _crawlNewMaps = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  var today = new Date()
  var yesterday = new Date(new Date().setDate(today.getDate()-1))
  var t_s = today.toISOString().slice(0,10)
  var y_s = yesterday.toISOString().slice(0,10)

  hltv.getMatchesStats({startDate: y_s, endDate: t_s, rankingFilter: "Top50"}).then((matches) => {
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
    {
      name: 'crawlUpcomingMatches',
      handler: _crawlUpcomingMatches,
    },
    {
      name: 'crawlNewMaps', 
      handler: _crawlNewMaps,
    },
    {
      name: 'updateMatch',
      handler: _updateMatch,
    },
    {
      name: 'updateSeries',
      handler: _updateSeries,
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
