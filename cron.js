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

  db.collection('upcoming_matches').findOne({"details": null}, function(err, target){
    HLTV.getMatch({id: target.id}).then(res => {
      db.collection('upcoming_matches').updateOne({_id: target._id}, {$set: {"details": res}}, errorHandler("update upcoming match with id = " + target._id))
    }).catch(eHandler)
  })
}

var _crawlUpcomingMatches = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('upcoming_matches').deleteMany({});
  console.log(hltv)

  hltv.getMatches().then((matches) => {
    var upcoming = matches.filter(function(match){
      if (match.live == false)
        return true
    })

    db.collection('upcoming_matches').insertMany(upcoming, errorHandler("insert upcoming matches"))
  }).catch(eHandler)
}

var _updateTeam = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('teams').find({ stats: null }).limit(1).toArray(function(err, result){
    if (err) {
      console.error(err)
      return
    }
    result.forEach(function(team){
      hltv.getTeamStats({id: team.team.id}).then((team_stat) => {
        console.log("update team stats ", team._id)
        if (team_stat === null) {
          return
        }
        db.collection('teams').updateOne({_id: team._id}, {$set: {"stats": team_stat}}, errorHandler("updating team with id = " + team._id));
      }).catch(eHandler)
    })
  });
}

var _updateMatch = function() {
  const db = getDb().db();
  const hltv = getHLTV();

  db.collection('match_maps').find({ stats: null }).limit(1).toArray(function(err, result){
    if (err) {
      console.error(err)
      return
    }
    result.forEach(function(match_map){
      hltv.getMatchMapStats({id: match_map.id}).then((map_stat) => {
        db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {"stats": map_stat}}, function(err, res) {
          if (err) {
            console.error("error when crawl map stats", match_map.id, err)
            return
          }
          console.log("Number of match updated: 1");
        });
      }).catch(eHandler)
    })
  });
}

var runJob = function(){
  var jobIndex = 0

  const jobList = [
    {
      name: 'updateUpcomingMatches', 
      handler: _updateUpcomingMatch,
    },
    {
      name: 'updateMatch',
      handler: _updateMatch,
    },
    {
      name: 'crawlUpcomingMatches',
      handler: _crawlUpcomingMatches,
    },
    {
      name: 'updateTeam',
      handler: _updateTeam,
    },
  ]

  if (jobIndex == 3)
    jobIndex = 0;
  else
    jobIndex++;

  console.log("starting cron job %s", jobList[jobIndex].name)
  return jobList[jobIndex].handler
}

function startCronScheduler(){
  var job = new CronJob(process.env.CRON_FORMAT, runJob(), null, false);
  job.start()
}

module.exports = {
    startCronScheduler
};
