const { HLTV } = require('./HLTV')
var CronJob = require('cron').CronJob;
var https = require('https') 
require('dotenv').config()

const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
var HttpsProxyAgent = require('https-proxy-agent');

const PORT = process.env.PORT || 5000

var test

const express = require("express");
var app = express();


initDb(function (err) {
  app.listen(PORT, function (err) {
    if (err) {
      throw err; //
    }
    console.log("API Up and running on port " + PORT);
  });

  var agent;
  var myHLTV = HLTV.createInstance({})
  var changeProxy = function() {
    var since_last_change = 0
    return function(u, m){
      if (u == 'false') return
      if (since_last_change < m) {
        since_last_change++
        console.log("increment tick proxy")
        console.log(since_last_change, m)
        return
      }
      since_last_change = 0

      var options = {
        host: 'api.getproxylist.com',
        port: 443,
        path: '/proxy?country=US',
        method: 'GET'
      };
      var req = https.request(options, function(resp){
        resp.on('data', function (chunk) {
          var body = JSON.parse(String(chunk));
          console.log('using proxy server %s:%d', body['ip'], body['port']);
          agent = new HttpsProxyAgent(body['ip']+":"+body['port']);
          myHLTV = HLTV.createInstance({httpAgent: agent})
        });
      }).end();
    }(process.env.USE_PROXY, Number(process.env.MAX_TICK_BEFORE_CHANGE_PROXY))
  }
  changeProxy();

  app.get("/crawl-teams", (req, res, next) => {
    // HLTV.getTeamStats({id: 6665}).then(teamStats => {
    // res.json(teamStats);
    // })
    const db = getDb().db();
    HLTV.getTeamExtraStats({startDate: req.query.startDate, endDate: req.query.endDate, rankingFilter: req.query.rankingFilter}).then((teams) => {
      teams.forEach(function(item){
        db.collection('teams').findOne({"team.id": item.team.id}, function(err, result){
          if (result !== null) {
            console.log("replace team stats")
            db.collection('teams').replaceOne({_id: result._id}, item, function(err, res) {
              if (err) {
                console.error(err)
                return
              }
            });
            return
          }
          console.log("insert new team stats")
          db.collection('teams').insertOne(item, function(err, res) {
            if (err) {
              console.error(err)
              return
            }
          });
        });
      })
      res.json(teams);
    })
  });

  app.get("/crawl-matches", (req, res, next) => {
    // HLTV.getTeamStats({id: 6665}).then(teamStats => {
    // res.json(teamStats);
    // })
    const db = getDb().db();
    HLTV.getMatchesStats({startDate: req.query.startDate, endDate: req.query.endDate, rankingFilter: req.query.rankingFilter}).then((matches) => {
      matches.forEach(function(item){
        db.collection('match_maps').findOne({id: item.id}, function(err, result){
          if (result !== null) return
          console.log("insert new match")
          db.collection('match_maps').insertOne(item, function(err, res) {
            if (err) {
              console.error(err)
              return
            }
          });
        });
      })
      res.json(matches);
    })
  });

  var jobUpdateTeams = new CronJob(process.env.CRON_FORMAT_UPDATE_TEAM, function() {
    const db = getDb().db();
    db.collection('teams').find({ stats: null }).limit(1).toArray(function(err, result){
      if (err) {
        console.error(err)
        return
      }
      result.forEach(function(team){
        HLTV.getTeamStats({id: team.team.id}).then((team_stat) => {
          console.log("update team stats ", team._id)
          if (team_stat === null) {
            changeProxy()
            return
          }
          db.collection('teams').updateOne({_id: team._id}, {$set: {"stats": team_stat}}, function(err, res) {
            if (err) {
              console.error("error when crawl team stats", team.team.id, err)
              return
            }
            console.log("Number of documents updated: 1");
          });
        }).catch((error) => {
          console.error(error)
          changeProxy()
        })
      })
    });
  }, null, false);
  jobUpdateTeams.start()

  var job = new CronJob(process.env.CRON_FORMAT, function() {
    const db = getDb().db();
    db.collection('match_maps').find({ stats: null }).limit(1).toArray(function(err, result){
      if (err) {
        console.error(err)
        return
      }
      console.log(result)
      result.forEach(function(match_map){
        console.log(match_map.id)
        HLTV.getMatchMapStats({id: match_map.id}).then((map_stat) => {
          if (map_stat === null) changeProxy()
          db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {"stats": map_stat}}, function(err, res) {
            if (err) {
              console.error("error when crawl map stats", match_map.id, err)
              return
            }
            console.log("Number of documents updated: 1");
          });
        }).catch((error) => {
          console.error(error)
          changeProxy()
        })
      })
    });
  }, null, false);
  job.start()
});

